const { createServer } = require('vite');

const startVite = async () => {
  try {
    const server = await createServer();
    await server.listen();
    console.log('Vite server is running...');
  } catch (error) {
    console.error('Failed to start Vite server:', error);
  }
};

startVite();

