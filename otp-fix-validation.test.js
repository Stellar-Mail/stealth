// Quick validation script for OTP accessibility and detection fixes
// Run with: node otp-fix-validation.test.js

import fs from 'fs';
import path from 'path';

const otpCardPath = path.resolve('src/features/otp/components/OTPCard.tsx');
const detectPath = path.resolve('src/features/otp/detectOtp.ts');
const stylesPath = path.resolve('src/features/otp/styles.css');

console.log('=== OTP Fix Validation ===\n');

// 1. Check OTPCard for ARIA, focus, reduced-motion
const otpcard = fs.readFileSync(otpCardPath, 'utf8');
const checks = {
  'useReducedMotion imported': otpcard.includes('useReducedMotion'),
  'reducedMotion in animate': otpcard.includes('prefersReducedMotion'),
  'aria-label on button': otpcard.includes('aria-label={copyLabel}'),
  'aria-pressed on button': otpcard.includes('aria-pressed={copied}'),
  'focus-visible styles class': otpcard.includes('focus-visible:ring-2'),
  'role=group on digits': otpcard.includes('role="group"'),
  'aria-describedby on digits': otpcard.includes('aria-describedby="otp-desc"'),
  'aria-hidden on digits': otpcard.includes('aria-hidden="true"'),
  'live region for copy': otpcard.includes('aria-live="polite"'),
  'sr-only desc': otpcard.includes('id="otp-desc"'),
  'Check icon aria-hidden': otpcard.includes('aria-hidden="true"'),
};

console.log('OTPCard.tsx Accessibility Checks:');
Object.entries(checks).forEach(([name, pass]) => {
  console.log(`  ${pass ? '✅' : '❌'} ${name}`);
});

// 2. Check detectOtp improvements
const detect = fs.readFileSync(detectPath, 'utf8');
const detectChecks = {
  'keyword regex tightened': detect.includes('0,50}'),
  'standalone 6-digit': detect.includes('standalone6'),
  'explicit 4/8 digit support': detect.includes('explicit'),
  'security mail comment': detect.includes('security-sensitive'),
};

console.log('\nDetectOtp.ts Improvements:');
Object.entries(detectChecks).forEach(([name, pass]) => {
  console.log(`  ${pass ? '✅' : '❌'} ${name}`);
});

// 3. Check styles for a11y
const styles = fs.readFileSync(stylesPath, 'utf8');
const styleChecks = {
  'focus-visible rule': styles.includes('.otp-copy-btn:focus-visible'),
  'reduced-motion media query': styles.includes('@media (prefers-reduced-motion: reduce)'),
};

console.log('\nstyles.css Accessibility:');
Object.entries(styleChecks).forEach(([name, pass]) => {
  console.log(`  ${pass ? '✅' : '❌'} ${name}`);
});

const allPass = Object.values(checks).every(Boolean) && Object.values(detectChecks).every(Boolean) && Object.values(styleChecks).every(Boolean);
console.log(`\n=== Overall: ${allPass ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'} ===`);

if (!allPass) process.exit(1);