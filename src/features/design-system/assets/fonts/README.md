# Mail Typography

These normal-style, variable-weight WOFF2 Latin subsets are served from the app
origin. Do not replace them with a Google Fonts CSS import: the app intentionally
uses `style-src 'self'` and `font-src 'self'`.

- Inter: interface text, weights 400-700.
- Space Grotesk: original mail preview names and subjects, weights 400-700.
- Newsreader: mail body, optical size 6-72 and weights 400-700.

The families were already declared by the original mail UI. Other scripts use the
existing system-font fallback. Vite fingerprints the font assets during builds.
Each family is distributed under its included SIL Open Font License.

## Sources

- Inter: https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2
- Space Grotesk: https://fonts.gstatic.com/s/spacegrotesk/v22/V8mDoQDjQSkFtoMM3T6r8E7mPbF4Cw.woff2
- Newsreader: https://fonts.gstatic.com/s/newsreader/v26/cY9AfjOCX1hbuyalUrK4397yjA.woff2
- Licenses: https://github.com/google/fonts/tree/main/ofl (inter, spacegrotesk, newsreader).

`styles/fonts.css` owns the face declarations, supported Unicode ranges and
preview/reader classes. Keep the card's sizes and line heights separate from the
font loading rules.
