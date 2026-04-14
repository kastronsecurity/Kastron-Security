
import fetch from 'node-fetch';

async function checkHealth() {
  try {
    const response = await fetch('http://localhost:3000/api/health');
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error checking health:', error);
  }
}

checkHealth();
