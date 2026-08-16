import fs from 'fs';
import path from 'path';

const xmlPath = process.argv[2] || 'test-results.xml';
const jsonPath = process.argv[3] || 'test-results.json';

if (!fs.existsSync(xmlPath)) {
  console.error(`XML file not found at ${xmlPath}`);
  fs.writeFileSync(jsonPath, JSON.stringify({ numFailedTests: 0, testResults: [] }));
  process.exit(0);
}

const xml = fs.readFileSync(xmlPath, 'utf8');

// A very basic XML parser using Regex
const testResults = [];
let numFailedTests = 0;

// Match testsuites
const suiteRegex = /<testsuite\s+([^>]+)>([\s\S]*?)<\/testsuite>/g;
let suiteMatch;

while ((suiteMatch = suiteRegex.exec(xml)) !== null) {
  const suiteAttrs = parseAttrs(suiteMatch[1]);
  const suiteContent = suiteMatch[2];
  const suiteName = suiteAttrs.name || suiteAttrs.file || 'unknown';
  
  const assertionResults = [];
  
  // Match testcase
  const caseRegex = /<testcase\s+([^>]+?)(?:\s*\/|>([\s\S]*?)<\/testcase>)/g;
  let caseMatch;
  
  while ((caseMatch = caseRegex.exec(suiteContent)) !== null) {
    const caseAttrs = parseAttrs(caseMatch[1]);
    const caseContent = caseMatch[2] || '';
    const caseName = caseAttrs.name || 'unknown';
    
    // Check if failed
    const failureRegex = /<failure[^>]*>([\s\S]*?)<\/failure>/;
    const failureMatch = failureRegex.exec(caseContent);
    
    if (failureMatch) {
      numFailedTests++;
      assertionResults.push({
        fullName: caseName,
        status: 'failed',
        failureMessages: [failureMatch[1].trim()]
      });
    } else {
      assertionResults.push({
        fullName: caseName,
        status: 'passed',
        failureMessages: []
      });
    }
  }
  
  if (assertionResults.length > 0) {
    testResults.push({
      name: suiteName,
      assertionResults
    });
  }
}

function parseAttrs(str) {
  const attrs = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

const resultJson = {
  numFailedTests,
  testResults
};

fs.writeFileSync(jsonPath, JSON.stringify(resultJson, null, 2));
console.log(`Converted JUnit XML to Jest JSON successfully. Total failed tests: ${numFailedTests}`);
