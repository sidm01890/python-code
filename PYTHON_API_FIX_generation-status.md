# Python API Fix: `/api/reconciliation/generation-status`

## Issues Fixed

### 1. **Field Name Mismatch** ✅
**Problem**: API expected `generation_id` but frontend/Postman was sending `task_id` or `job_id`

**Solution**: 
- Made `generation_id` optional
- Added support for `task_id`, `job_id` (with aliases: `taskId`, `jobId`)
- Created `get_generation_id()` method that tries to extract numeric ID from any of these fields
- Fully backward compatible - existing code using `generation_id` still works

### 2. **Missing Functionality** ✅
**Problem**: Python API only returned a single generation by ID, while Node.js version returns all generations

**Solution**:
- Made `generation_id` optional
- When `generation_id` is provided → returns that specific generation (original behavior)
- When `generation_id` is NOT provided → returns all generations with filtering/pagination (like Node.js version)

### 3. **No Filtering/Pagination** ✅
**Problem**: No way to filter or paginate results

**Solution**: Added comprehensive filtering and pagination:
- Filter by `status` (single or comma-separated: "completed,failed")
- Filter by `store_code_pattern` (partial match)
- Filter by date range (`start_date`, `end_date`)
- Pagination with `limit` and `offset`
- Returns pagination metadata

### 4. **Stale Pending Jobs** ✅
**Problem**: No automatic cleanup of stuck pending jobs

**Solution**:
- Automatically marks `pending` jobs older than 30 minutes as `failed`
- Configurable threshold via `stale_threshold_minutes`
- Can be disabled with `exclude_stale_pending: false`

## Updated Request Model

```python
class GenerationStatusRequest(BaseModel):
    # Support multiple field names for backward compatibility
    generation_id: Optional[int] = None          # Original field
    task_id: Optional[str] = None                # Alternative (auto-converted to int if numeric)
    job_id: Optional[str] = None                 # Alternative (auto-converted to int if numeric)
    
    # Filtering options
    status: Optional[str] = None                 # e.g., "completed" or "completed,failed"
    store_code_pattern: Optional[str] = None     # e.g., "SummaryReport"
    start_date: Optional[str] = None              # Filter by created_at
    end_date: Optional[str] = None
    
    # Pagination
    limit: int = 100                              # Default: 100, max: 1000
    offset: int = 0                               # Default: 0
    
    # Stale job handling
    exclude_stale_pending: bool = True           # Auto-mark stale as failed
    stale_threshold_minutes: int = 30             # Threshold in minutes
```

## Usage Examples

### Example 1: Get Specific Generation (Original Behavior)
```json
POST /api/reconciliation/generation-status
{
  "generation_id": 34
}
```
OR (backward compatible with task_id):
```json
{
  "task_id": "34"
}
```

### Example 2: Get All Generations (New Behavior - Like Node.js)
```json
POST /api/reconciliation/generation-status
{}
```

### Example 3: Filter by Status
```json
POST /api/reconciliation/generation-status
{
  "status": "completed",
  "limit": 20
}
```

### Example 4: Filter Multiple Statuses
```json
POST /api/reconciliation/generation-status
{
  "status": "completed,failed",
  "limit": 50
}
```

### Example 5: Filter by Store Code Pattern
```json
POST /api/reconciliation/generation-status
{
  "store_code_pattern": "SummaryReport",
  "limit": 10
}
```

### Example 6: Filter by Date Range
```json
POST /api/reconciliation/generation-status
{
  "start_date": "2025-11-01T00:00:00.000Z",
  "end_date": "2025-11-02T23:59:59.000Z"
}
```

### Example 7: With Pagination
```json
POST /api/reconciliation/generation-status
{
  "limit": 50,
  "offset": 0
}
```

### Example 8: Disable Stale Job Cleanup
```json
POST /api/reconciliation/generation-status
{
  "exclude_stale_pending": false
}
```

## Response Format

### Single Generation (when generation_id provided)
```json
{
  "success": true,
  "data": {
    "id": 34,
    "store_code": "SummaryReport_556 store(s)",
    "start_date": "2024-12-01T00:00:00.000Z",
    "end_date": "2024-12-07T23:59:59.000Z",
    "status": "COMPLETED",
    "progress": 100,
    "message": "Excel generation completed successfully",
    "filename": "reconciliation_556_stores_01-12-2024_07-12-2024_34.xlsx",
    "error": null,
    "created_at": "2025-11-01T11:43:57.000Z",
    "updated_at": "2025-11-01T11:43:59.000Z",
    "download_url": "/api/reconciliation/download/34"
  }
}
```

### Multiple Generations (when generation_id NOT provided)
```json
{
  "success": true,
  "data": [
    {
      "id": 34,
      "store_code": "SummaryReport_556 store(s)",
      ...
      "download_url": "/api/reconciliation/download/34"
    },
    {
      "id": 33,
      ...
    }
  ],
  "pagination": {
    "total": 34,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

## Backward Compatibility

✅ **Fully Backward Compatible**
- Empty request body `{}` → Returns all generations (new behavior)
- `{"generation_id": 34}` → Returns that specific generation (original behavior)
- Existing frontend code continues to work

## Changes Made

### Files Modified:

1. **`python/app/routes/reconciliation.py`**
   - Updated `GenerationStatusRequest` model with flexible field support
   - Enhanced `check_generation_status` endpoint with filtering, pagination, and stale job cleanup
   - Added support for returning all generations when no ID provided

2. **`python/app/models/main/excel_generation.py`**
   - Enhanced `get_all()` method with filtering parameters
   - Added `count_all()` method for pagination
   - Added `mark_stale_pending_as_failed()` method for automatic cleanup

## Testing

### Test Case 1: Original Request (Should Work)
```bash
POST /api/reconciliation/generation-status
{"generation_id": 34}
```
Expected: Returns single generation with ID 34

### Test Case 2: Task ID (Should Work Now)
```bash
POST /api/reconciliation/generation-status
{"task_id": "34"}
```
Expected: Returns single generation with ID 34

### Test Case 3: Empty Request (Should Work)
```bash
POST /api/reconciliation/generation-status
{}
```
Expected: Returns all generations (up to 100 by default)

### Test Case 4: Filtering
```bash
POST /api/reconciliation/generation-status
{"status": "completed", "limit": 10}
```
Expected: Returns up to 10 completed generations

## Benefits

1. ✅ **Fixes the 422 error** - Now accepts `task_id`, `job_id`, or `generation_id`
2. ✅ **Matches Node.js behavior** - Returns all generations by default
3. ✅ **Better UX** - Filtering and pagination options
4. ✅ **Automatic cleanup** - Stale pending jobs marked as failed
5. ✅ **Backward compatible** - Existing code continues to work
6. ✅ **Flexible** - Supports multiple ways to query

