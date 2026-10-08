#!/usr/bin/env node
/**
 * AI Agent Setup Script
 * Configures free API keys for PDF generation
 * Run: node setup/setup.js
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env');
const ENV_EXAMPLE = path.join(__dirname, '..', '.env.example');

// Verify .env.example exists
if (!fs.existsSync(ENV_EXAMPLE)) {
  console.error('ERROR: .env.example not found.');
  process.exit(1);
}

// Check if .env already exists
const envExists = fs.existsSync(ENV_FILE);

// Read the example template
let template = fs.readFileSync(ENV_EXAMPLE, 'utf-8');

// Create or update .env
let config = '';
if (envExists) {
  config = fs.readFileSync(ENV_FILE, 'utf-8');
} else {
  // Copy example as base
  config = template;
}

// Check which keys are already set
const keysToSet = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY'];

console.log('=== XamCode AI Agent Setup ===\n');
console.log('This will configure free API keys for PDF generation.\n');

// Check existing keys
console.log('Checking existing configuration...');
const existingKeys = {};
keysToSet.forEach(key => {
  const line = config.split('\n').find(l => l.startsWith(key + '='));
  if (line) {
    const value = line.split('=')[1].trim();
    if (value && !value.startsWith('replace_') && !value.startsWith('your_') && value.length > 5) {
      existingKeys[key] = true;
      console.log(`  ✓ ${key} already configured`);
    } else {
      console.log(`  ✗ ${key} needs configuration`);
    }
  } else {
    console.log(`  ✗ ${key} not found`);
  }
});

console.log('\n=== Configuration Instructions ===\n');

// Gemini instructions
console.log('1. Google Gemini (REQUIRED for PDF generation)');
console.log('   Sign up: https://aistudio.google.com');
console.log('   Free tier: 1,500-10,000 requests/day');
console.log('   Steps:');
console.log('   a. Create an account');
console.log('   b. Go to "API Keys" → "Create API Key"');
console.log('   c. Copy your key\n');

// Groq instructions
console.log('2. Groq (Optional - for text chat fallback)');
console.log('   Sign up: https://console.groq.com');
console.log('   Free tier: ~1,000 requests/day');
console.log('   Steps:');
console.log('   a. Create an account');
console.log('   b. Go to "API Keys" in dashboard');
console.log('   c. Copy your key\n');

// OpenRouter instructions
console.log('3. OpenRouter (Optional - text fallback)');
console.log('   Sign up: https://openrouter.ai');
console.log('   Steps:');
console.log('   a. Create an account');
console.log('   b. Go to "API Keys"');
console.log('   c. Copy your key\n');

// If no keys exist, ask user to configure
if (Object.keys(existingKeys).length === 0) {
  console.log('No API keys configured. Please configure them manually.');
  console.log('Or, if you have your keys ready, you can edit .env manually.');
}

// Create/update .env file
if (envExists) {
  console.log('\\n=== Updating existing .env ===');
  // Just verify the file exists
} else {
  console.log('=== Creating .env from .env.example ===');
  fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
  console.log('Created .env from .env.example');
}

console.log('\n=== Next Steps ===');
console.log('1. Edit .env and add your API keys:');
console.log('   GEMINI_API_KEY=AIzaSyYourKeyHere');
console.log('   GROQ_API_KEY=gsk_YourKeyHere');
console.log('   OPENROUTER_API_KEY=sk-or-v1_YourKeyHere');
console.log('2. Start the server: node server.js');
console.log('3. Check providers: curl http://localhost:4173/api/providers');
console.log('4. Test PDF: node setup/test-pdf-generation.js');

console.log('\n=== Free Provider Summary ===');
console.log('• Gemini: PDF required (free tier)');
console.log('• Groq: Text fallback (free tier)');
console.log('• OpenRouter: Text fallback (free tier)');
console.log('• Total cost: $0/month\n');
