# Vendored libraries

Third-party browser builds, committed so the site makes no CDN requests at runtime.
Both are MIT licensed (licence files alongside).

| File | Library | Version | Source |
|---|---|---|---|
| `chart-4.4.1.umd.js` | [Chart.js](https://www.chartjs.org/) | 4.4.1 | npm `chart.js@4.4.1` → `dist/chart.umd.js` |
| `html2canvas-1.4.1.min.js` | [html2canvas](https://html2canvas.hertzen.com/) | 1.4.1 | npm `html2canvas@1.4.1` → `dist/html2canvas.min.js` |

SHA-256:

```
0ee28337f25838a7a5d6b1e8b2b02279ab10e80e17c217a99893a7a717f2ba05  chart-4.4.1.umd.js
e87e550794322e574a1fda0c1549a3c70dae5a93d9113417a429016838eab8cb  html2canvas-1.4.1.min.js
```

Only modification: the trailing `//# sourceMappingURL=chart.umd.js.map` comment was removed from the Chart.js file (the map isn't shipped, and it caused a devtools 404).

## Upgrading

```sh
cd "$(mktemp -d)" && npm pack chart.js@<version> html2canvas@<version>
# extract, copy the dist files above into this folder with the new version in the name,
# update the <script> tags in pulse/report.html, the table and hashes here, then delete the old files.
```
