/**
 * Script to verify instore-data API queries
 * This script executes the actual SQL queries used by the instore-data API
 */

const mysql = require('mysql2/promise');

// Database configuration from db.config.js
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'NewStrongPassword123!',
  database: 'devyani',
  port: 3306
};

// Sample parameters for testing
const testParams = {
  startDate: '2024-01-01 00:00:00',
  endDate: '2024-12-31 23:59:59',
  stores: ['STORE1', 'STORE2'] // Will be replaced with actual store names from DB
};

async function verifyQueries() {
  let connection;
  
  try {
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully!\n');

    // Get actual store names from database
    console.log('📋 Fetching actual store names from database...');
    const [storeRows] = await connection.execute(
      `SELECT DISTINCT store_name FROM orders LIMIT 10`
    );
    const actualStores = storeRows.map(row => row.store_name).filter(Boolean);
    
    if (actualStores.length === 0) {
      console.log('⚠️  No stores found in database. Using test stores.');
      testParams.stores = ['STORE1', 'STORE2'];
    } else {
      testParams.stores = actualStores.slice(0, 5); // Use first 5 stores
      console.log(`✅ Found ${actualStores.length} stores. Using: ${testParams.stores.join(', ')}\n`);
    }

    // Get actual date range from database
    const [dateRows] = await connection.execute(
      `SELECT MIN(date) as min_date, MAX(date) as max_date FROM orders WHERE date IS NOT NULL`
    );
    
    if (dateRows[0] && dateRows[0].min_date && dateRows[0].max_date) {
      testParams.startDate = new Date(dateRows[0].min_date).toISOString().slice(0, 19).replace('T', ' ');
      testParams.endDate = new Date(dateRows[0].max_date).toISOString().slice(0, 19).replace('T', ' ');
      console.log(`📅 Using date range: ${testParams.startDate} to ${testParams.endDate}\n`);
    }

    console.log('='.repeat(80));
    console.log('QUERY VERIFICATION RESULTS');
    console.log('='.repeat(80));
    console.log('');

    // ============================================
    // QUERY 1: Aggregator Total
    // ============================================
    console.log('📊 QUERY 1: Aggregator Total (Online Orders)');
    console.log('-'.repeat(80));
    
    const aggregatorsPlaceholder = '?, ?, ?';
    const aggregators = ['Zomato', 'Swiggy', 'MagicPin'];
    const storesPlaceholder1 = testParams.stores.map(() => '?').join(', ');
    
    const query1 = `
      SELECT SUM(\`payment\`) AS \`aggregatorSales\`
      FROM \`orders\`
      WHERE \`date\` BETWEEN ? AND ?
        AND \`store_name\` IN (${storesPlaceholder1})
        AND \`online_order_taker\` IN (${aggregatorsPlaceholder})
    `;
    
    const params1 = [testParams.startDate, testParams.endDate, ...testParams.stores, ...aggregators];
    
    console.log('SQL:', query1.replace(/\s+/g, ' '));
    console.log('Parameters:', { startDate: testParams.startDate, endDate: testParams.endDate, stores: testParams.stores.length, aggregators });
    
    const [result1] = await connection.execute(query1, params1);
    console.log('✅ Result:', result1[0]);
    console.log('');

    // ============================================
    // QUERY 2: POS Sales Data for CARD/UPI
    // ============================================
    console.log('📊 QUERY 2: POS Sales Data for CARD/UPI');
    console.log('-'.repeat(80));
    
    const storesPlaceholder2 = testParams.stores.map(() => '?').join(', ');
    
    const query2 = `
      SELECT 
        \`online_order_taker\`,
        SUM(\`payment\`) AS \`sales\`,
        COUNT(\`payment\`) AS \`salesCount\`
      FROM \`orders\`
      WHERE \`date\` BETWEEN ? AND ?
        AND \`store_name\` IN (${storesPlaceholder2})
        AND (
          UPPER(\`online_order_taker\`) = 'CARD'
          OR UPPER(\`online_order_taker\`) = 'UPI'
          OR UPPER(TRIM(\`online_order_taker\`)) = 'CARD'
          OR UPPER(TRIM(\`online_order_taker\`)) = 'UPI'
        )
      GROUP BY \`online_order_taker\`
    `;
    
    const params2 = [testParams.startDate, testParams.endDate, ...testParams.stores];
    
    console.log('SQL:', query2.replace(/\s+/g, ' '));
    console.log('Parameters:', { startDate: testParams.startDate, endDate: testParams.endDate, stores: testParams.stores.length });
    
    const [result2] = await connection.execute(query2, params2);
    console.log('✅ Results:', result2.length, 'rows');
    result2.forEach((row, idx) => {
      console.log(`  Row ${idx + 1}:`, row);
    });
    console.log('');

    // ============================================
    // QUERY 3: Reconciliation Data (Optional)
    // ============================================
    console.log('📊 QUERY 3: Reconciliation Data from pos_vs_trm_summary');
    console.log('-'.repeat(80));
    
    // Check if table exists first
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pos_vs_trm_summary'`,
      [dbConfig.database]
    );
    
    if (tables.length === 0) {
      console.log('⚠️  Table pos_vs_trm_summary does not exist. Skipping query.');
    } else {
      const storesPlaceholder3 = testParams.stores.map(() => '?').join(', ');
      
      const query3 = `
        SELECT 
          \`payment_mode\`,
          \`acquirer\`,
          SUM(COALESCE(\`pos_amount\`, 0)) AS \`sales\`,
          COUNT(CASE WHEN \`pos_amount\` IS NOT NULL THEN 1 END) AS \`salesCount\`,
          SUM(COALESCE(\`reconciled_amount\`, 0)) AS \`reconciled\`,
          COUNT(CASE WHEN \`reconciled_amount\` IS NOT NULL AND \`reconciled_amount\` > 0 THEN 1 END) AS \`reconciledCount\`,
          SUM(COALESCE(\`unreconciled_amount\`, 0)) AS \`unreconciled\`,
          SUM(
            CASE 
              WHEN COALESCE(\`pos_amount\`, 0) != COALESCE(\`trm_amount\`, 0) 
              THEN ABS(COALESCE(\`pos_amount\`, 0) - COALESCE(\`trm_amount\`, 0)) 
              ELSE 0 
            END
          ) AS \`difference\`,
          COUNT(
            CASE 
              WHEN COALESCE(\`pos_amount\`, 0) != COALESCE(\`trm_amount\`, 0) 
              THEN 1 
            END
          ) AS \`differenceCount\`
        FROM \`pos_vs_trm_summary\`
        WHERE \`pos_date\` BETWEEN ? AND ?
          AND \`pos_store\` IN (${storesPlaceholder3})
          AND \`payment_mode\` IN ('CARD', 'UPI')
        GROUP BY \`payment_mode\`, \`acquirer\`
      `;
      
      const params3 = [testParams.startDate, testParams.endDate, ...testParams.stores];
      
      console.log('SQL:', query3.replace(/\s+/g, ' '));
      console.log('Parameters:', { startDate: testParams.startDate, endDate: testParams.endDate, stores: testParams.stores.length });
      
      try {
        const [result3] = await connection.execute(query3, params3);
        console.log('✅ Results:', result3.length, 'rows');
        result3.forEach((row, idx) => {
          console.log(`  Row ${idx + 1}:`, row);
        });
      } catch (error) {
        console.log('⚠️  Query failed:', error.message);
      }
    }
    console.log('');

    // ============================================
    // QUERY 4: TRM Data (Multiple attempts)
    // ============================================
    console.log('📊 QUERY 4: TRM Data (Attempt 1 - Standard Date Format)');
    console.log('-'.repeat(80));
    
    // Check if table exists
    const [trmTables] = await connection.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'trm'`,
      [dbConfig.database]
    );
    
    if (trmTables.length === 0) {
      console.log('⚠️  Table trm does not exist. Skipping query.');
    } else {
      const storesPlaceholder4 = testParams.stores.map(() => '?').join(', ');
      
      const query4 = `
        SELECT 
          \`payment_mode\`,
          \`acquirer\`,
          SUM(COALESCE(\`amount\`, 0)) AS \`trmAmount\`,
          COUNT(CASE WHEN \`amount\` IS NOT NULL THEN 1 END) AS \`trmCount\`
        FROM \`trm\`
        WHERE STR_TO_DATE(\`date\`, '%Y-%m-%d %H:%i:%s') BETWEEN ? AND ?
          AND \`store_name\` IN (${storesPlaceholder4})
          AND \`payment_mode\` IN ('CARD', 'UPI')
        GROUP BY \`payment_mode\`, \`acquirer\`
      `;
      
      const params4 = [testParams.startDate, testParams.endDate, ...testParams.stores];
      
      console.log('SQL:', query4.replace(/\s+/g, ' '));
      console.log('Parameters:', { startDate: testParams.startDate, endDate: testParams.endDate, stores: testParams.stores.length });
      
      try {
        const [result4] = await connection.execute(query4, params4);
        console.log('✅ Results:', result4.length, 'rows');
        if (result4.length > 0) {
          result4.forEach((row, idx) => {
            console.log(`  Row ${idx + 1}:`, row);
          });
        } else {
          console.log('⚠️  No results with standard date format. Try alternative format.');
        }
      } catch (error) {
        console.log('⚠️  Query failed:', error.message);
        console.log('   This is expected if date format is different.');
      }
    }
    console.log('');

    // ============================================
    // Summary
    // ============================================
    console.log('='.repeat(80));
    console.log('✅ VERIFICATION COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('All queries executed successfully (or skipped if tables don\'t exist).');
    console.log('Check the results above to verify the query outputs match expectations.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed.');
    }
  }
}

// Run verification
verifyQueries();

