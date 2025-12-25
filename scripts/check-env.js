const { loadEnvConfig } = require('@next/env');

const projectDir = process.cwd();
loadEnvConfig(projectDir);

const REQUIRED_KEYS = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

const OPTIONAL_KEYS = [
    'NEXT_PUBLIC_GIPHY_API_KEY'
];

console.log('Checking environment variables...');

let missing = [];

REQUIRED_KEYS.forEach(key => {
    if (!process.env[key]) {
        console.error(`❌ Missing REQUIRED key: ${key}`);
        missing.push(key);
    } else {
        // Basic validation for URL
        if (key.includes('URL') && !process.env[key].startsWith('http')) {
             console.warn(`⚠️  ${key} does not look like a valid URL (value: ${process.env[key]})`);
        }
        console.log(`✅ Found ${key}`);
    }
});

OPTIONAL_KEYS.forEach(key => {
    if (!process.env[key]) {
        console.warn(`⚠️  Missing OPTIONAL key: ${key}`);
    } else {
        console.log(`✅ Found ${key}`);
    }
});

if (missing.length > 0) {
    console.error('\nEnvironment validation FAILED.');
    console.error('Please set the missing variables in .env.local or your deployment settings.');
    process.exit(1);
} else {
    console.log('\nEnvironment validation PASSED.');
    process.exit(0);
}
