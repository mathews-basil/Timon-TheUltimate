const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Timon Study Platform...\n');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✅ Created uploads directory');
} else {
    console.log('✅ Uploads directory already exists');
}

// Create .env file from config.env if it doesn't exist
const envPath = path.join(__dirname, '.env');
const configEnvPath = path.join(__dirname, 'config.env');

if (!fs.existsSync(envPath) && fs.existsSync(configEnvPath)) {
    fs.copyFileSync(configEnvPath, envPath);
    console.log('✅ Created .env file from config.env');
} else if (fs.existsSync(envPath)) {
    console.log('✅ .env file already exists');
} else {
    console.log('⚠️  Please create .env file with your configuration');
}

console.log('\n🎉 Setup complete!');
console.log('\nNext steps:');
console.log('1. Make sure MongoDB is running');
console.log('2. Run: npm install');
console.log('3. Run: npm start');
console.log('4. Open http://localhost:3000 in your browser');
console.log('\nDefault login credentials:');
console.log('Admin: username=admin, password=admin123');
console.log('User: username=user, password=user123');

