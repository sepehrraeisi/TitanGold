#!/usr/bin/env node

/**
 * Test script for data validation and normalization
 * Tests various message scenarios
 */

const testMessages = [
    // Valid message with text
    {
        id: 1,
        date: Math.floor(Date.now() / 1000),
        text: "Bitcoin price hits $45,000! 🚀 #crypto #btc Great news for investors @cryptotrader",
        views: 100,
        forwards: 10
    },
    // Message with Persian text
    {
        id: 2,
        date: Math.floor(Date.now() / 1000),
        text: "قیمت طلا امروز: ۲,۵۰۰,۰۰۰ تومان #طلا",
        views: 50,
        forwards: 5
    },
    // Invalid message (missing required fields)
    {
        text: "This message has no ID or date"
    },
    // Message with future date (warning)
    {
        id: 4,
        date: Math.floor(Date.now() / 1000) + 86400 * 2, // 2 days in future
        text: "Future message",
        views: 0,
        forwards: 0
    },
    // Message with multiple prices and URLs
    {
        id: 5,
        date: Math.floor(Date.now() / 1000),
        text: "Check prices: $1,234.56 and €999.99 on https://example.com and https://crypto.com",
        views: 200,
        forwards: 20
    },
    // Empty message (warning)
    {
        id: 6,
        date: Math.floor(Date.now() / 1000)
    },
    // Message with negative sentiment
    {
        id: 7,
        date: Math.floor(Date.now() / 1000),
        text: "Market crash! Bad news, high risk, major loss expected. Down trend continues.",
        views: 500,
        forwards: 50
    },
    // Message with positive sentiment
    {
        id: 8,
        date: Math.floor(Date.now() / 1000),
        text: "Excellent profit! Great success, high gains up trending. Good news for all!",
        views: 300,
        forwards: 30
    }
];

async function testValidation() {
    console.log('🧪 Testing Data Validation & Normalization\n');
    console.log('=' .repeat(80));

    try {
        const response = await fetch('http://localhost:3002/api/telegram-collector/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch: testMessages })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        // Print summary
        console.log('\n📊 Validation Summary:');
        console.log(`   Total Messages: ${result.summary.total}`);
        console.log(`   ✅ Valid: ${result.summary.valid}`);
        console.log(`   ❌ Invalid: ${result.summary.invalid}`);
        console.log(`   ⚠️  Warnings: ${result.summary.warnings}`);

        // Print detailed results
        console.log('\n' + '=' .repeat(80));
        console.log('📋 Detailed Results:\n');

        result.results.forEach((r, idx) => {
            const msg = testMessages[idx];
            const status = r.valid ? '✅' : '❌';
            
            console.log(`${status} Message ${idx + 1} (ID: ${msg.id || 'N/A'})`);
            console.log(`   Text: ${msg.text ? msg.text.substring(0, 50) + '...' : 'N/A'}`);
            
            if (r.errors.length > 0) {
                console.log(`   ❌ Errors:`);
                r.errors.forEach(err => console.log(`      - ${err}`));
            }
            
            if (r.warnings.length > 0) {
                console.log(`   ⚠️  Warnings:`);
                r.warnings.forEach(warn => console.log(`      - ${warn}`));
            }

            if (r.normalized) {
                const n = r.normalized.metadata;
                console.log(`   📊 Metadata:`);
                console.log(`      - Views: ${n.views}, Forwards: ${n.forwards}`);
                console.log(`      - Words: ${n.word_count}, Chars: ${n.char_count}`);
                console.log(`      - Language: ${n.language}`);
                console.log(`      - Sentiment: ${n.sentiment || 'N/A'}`);
                console.log(`      - Has URL: ${n.has_url}, Hashtags: ${n.has_hashtag}, Mentions: ${n.has_mention}`);

                const e = r.normalized.extracted;
                if (e.urls.length > 0) {
                    console.log(`      - URLs: ${e.urls.join(', ')}`);
                }
                if (e.hashtags.length > 0) {
                    console.log(`      - Hashtags: ${e.hashtags.join(', ')}`);
                }
                if (e.mentions.length > 0) {
                    console.log(`      - Mentions: ${e.mentions.join(', ')}`);
                }
                if (e.prices && e.prices.length > 0) {
                    console.log(`      - Prices: ${e.prices.map(p => `${p.currency}${p.value}`).join(', ')}`);
                }
            }

            if (r.content_hash) {
                console.log(`   🔐 Content Hash: ${r.content_hash.substring(0, 16)}...`);
            }

            console.log('');
        });

        console.log('=' .repeat(80));
        console.log('\n✅ All tests completed successfully!\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run tests
testValidation();
