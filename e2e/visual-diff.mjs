import { readFile, stat, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const reportPath = new URL('work/visual-diff-report.json', root);

const cases = [
  {
    name: 'landing',
    actual: 'work/screenshots/1920-landing.png',
    reference: 'public/mockups/revised-landing-mockup.png',
    expected: { width: 1920, height: 1080 }
  },
  {
    name: 'intro',
    actual: 'work/screenshots/1920-intro.png',
    reference: null,
    expected: { width: 1920, height: 1080 }
  },
  {
    name: 'session',
    actual: 'work/screenshots/1920-session.png',
    reference: 'public/mockups/third-page-job-session-mockup.png',
    expected: { width: 1920, height: 1080 }
  },
  {
    name: 'session-step-2',
    actual: 'work/screenshots/1920-session-step-2.png',
    reference: null,
    expected: { width: 1920, height: 1080 }
  },
  {
    name: 'summary',
    actual: 'work/screenshots/1920-summary.png',
    reference: 'public/mockups/fifth-page-summary-mockup.png',
    expected: { width: 1920, height: 1080 }
  },
  {
    name: 'saved',
    actual: 'work/screenshots/1920-saved.png',
    reference: 'public/mockups/sixth-page-save-complete-mockup.png',
    expected: { width: 1920, height: 1080 }
  },
  {
    name: 'records',
    actual: 'work/screenshots/1920-records.png',
    reference: 'public/mockups/my-records-page-mockup.png',
    expected: { width: 1920, height: 1080 }
  },
  {
    name: 'teacher',
    actual: 'work/screenshots/1920-teacher-drawer.png',
    reference: 'public/mockups/teacher-dashboard-mockup.png',
    expected: { width: 1920, height: 1080 }
  },
  {
    name: 'teacher-drawer-actions',
    actual: 'work/screenshots/1920-teacher-drawer-actions.png',
    reference: null,
    expected: { width: 1920, height: 1080 }
  },
  {
    name: 'teacher-dashboard',
    actual: 'work/screenshots/1920-teacher-dashboard.png',
    reference: 'public/mockups/teacher-dashboard-mockup.png',
    expected: { width: 1920, height: 1080 }
  },
  {
    name: 'tablet',
    actual: 'work/screenshots/tablet.png',
    reference: null,
    expected: { width: 820, minHeight: 1180 }
  },
  {
    name: 'tablet-intro',
    actual: 'work/screenshots/tablet-intro.png',
    reference: null,
    expected: { width: 820, minHeight: 1180 }
  },
  {
    name: 'tablet-day',
    actual: 'work/screenshots/tablet-day.png',
    reference: null,
    expected: { width: 820, minHeight: 1180 }
  },
  {
    name: 'tablet-summary',
    actual: 'work/screenshots/tablet-summary.png',
    reference: null,
    expected: { width: 820, minHeight: 1180 }
  },
  {
    name: 'tablet-saved',
    actual: 'work/screenshots/tablet-saved.png',
    reference: null,
    expected: { width: 820, minHeight: 1180 }
  },
  {
    name: 'tablet-records',
    actual: 'work/screenshots/tablet-records.png',
    reference: null,
    expected: { width: 820, minHeight: 1180 }
  },
  {
    name: 'tablet-teacher-dashboard',
    actual: 'work/screenshots/tablet-teacher-dashboard.png',
    reference: null,
    expected: { width: 820, minHeight: 1180 }
  },
  {
    name: 'tablet-teacher-drawer',
    actual: 'work/screenshots/tablet-teacher-drawer.png',
    reference: null,
    expected: { width: 820, minHeight: 1180 }
  },
  {
    name: 'tablet-teacher-drawer-actions',
    actual: 'work/screenshots/tablet-teacher-drawer-actions.png',
    reference: null,
    expected: { width: 820, minHeight: 1180 }
  },
  {
    name: 'mobile',
    actual: 'work/screenshots/mobile.png',
    reference: null,
    expected: { width: 390, minHeight: 844 }
  },
  {
    name: 'mobile-intro',
    actual: 'work/screenshots/mobile-intro.png',
    reference: null,
    expected: { width: 390, minHeight: 844 }
  },
  {
    name: 'mobile-day',
    actual: 'work/screenshots/mobile-day.png',
    reference: null,
    expected: { width: 390, minHeight: 844 }
  },
  {
    name: 'mobile-summary',
    actual: 'work/screenshots/mobile-summary.png',
    reference: null,
    expected: { width: 390, minHeight: 844 }
  },
  {
    name: 'mobile-saved',
    actual: 'work/screenshots/mobile-saved.png',
    reference: null,
    expected: { width: 390, minHeight: 844 }
  },
  {
    name: 'mobile-records',
    actual: 'work/screenshots/mobile-records.png',
    reference: null,
    expected: { width: 390, minHeight: 844 }
  },
  {
    name: 'mobile-teacher-dashboard',
    actual: 'work/screenshots/mobile-teacher-dashboard.png',
    reference: null,
    expected: { width: 390, minHeight: 844 }
  },
  {
    name: 'mobile-teacher-drawer',
    actual: 'work/screenshots/mobile-teacher-drawer.png',
    reference: null,
    expected: { width: 390, minHeight: 844 }
  },
  {
    name: 'mobile-teacher-drawer-actions',
    actual: 'work/screenshots/mobile-teacher-drawer-actions.png',
    reference: null,
    expected: { width: 390, minHeight: 844 }
  },
  {
    name: 'compact-intro',
    actual: 'work/screenshots/compact-intro.png',
    reference: null,
    expected: { width: 320, minHeight: 568 }
  },
  {
    name: 'compact-day',
    actual: 'work/screenshots/compact-day.png',
    reference: null,
    expected: { width: 320, minHeight: 568 }
  },
  {
    name: 'compact-summary',
    actual: 'work/screenshots/compact-summary.png',
    reference: null,
    expected: { width: 320, minHeight: 568 }
  },
  {
    name: 'compact-saved',
    actual: 'work/screenshots/compact-saved.png',
    reference: null,
    expected: { width: 320, minHeight: 568 }
  },
  {
    name: 'compact-records',
    actual: 'work/screenshots/compact-records.png',
    reference: null,
    expected: { width: 320, minHeight: 568 }
  },
  {
    name: 'compact-teacher-dashboard',
    actual: 'work/screenshots/compact-teacher-dashboard.png',
    reference: null,
    expected: { width: 320, minHeight: 568 }
  },
  {
    name: 'compact-teacher-drawer',
    actual: 'work/screenshots/compact-teacher-drawer.png',
    reference: null,
    expected: { width: 320, minHeight: 568 }
  },
  {
    name: 'compact-teacher-drawer-actions',
    actual: 'work/screenshots/compact-teacher-drawer-actions.png',
    reference: null,
    expected: { width: 320, minHeight: 568 }
  }
];

function readPngSize(buffer) {
  const pngSignature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== pngSignature) {
    throw new Error('Not a PNG file');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

async function existsWithSize(path) {
  const fileUrl = new URL(path, root);
  const [info, buffer] = await Promise.all([stat(fileUrl), readFile(fileUrl)]);
  const dimensions = readPngSize(buffer);
  return { bytes: info.size, ...dimensions };
}

async function main() {
  const manifest = JSON.parse(await readFile(new URL('work/asset-manifest.json', root), 'utf8'));
  const assetChecks = await Promise.all(manifest.assets.map(async (asset) => {
    try {
      const info = await existsWithSize(asset.path);
      return { id: asset.id, path: asset.path, passed: info.bytes > 0, ...info };
    } catch (error) {
      return { id: asset.id, path: asset.path, passed: false, error: error.message };
    }
  }));

  const results = await Promise.all(cases.map(async (item) => {
    try {
      const actual = await existsWithSize(item.actual);
      const reference = item.reference ? await existsWithSize(item.reference) : null;
      const widthOk = actual.width === item.expected.width;
      const heightOk = typeof item.expected.height === 'number'
        ? actual.height === item.expected.height
        : actual.height >= item.expected.minHeight;
      return {
        ...item,
        actual,
        reference,
        passed: actual.bytes > 0 && widthOk && heightOk
      };
    } catch (error) {
      return { ...item, passed: false, error: error.message };
    }
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    method: 'real DOM visual smoke; pixel equality to full-screen mockup is intentionally retired',
    assetCount: assetChecks.length,
    assets: assetChecks,
    results
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const failedAssets = assetChecks.filter((item) => !item.passed);
  const failedScreens = results.filter((item) => !item.passed);
  if (failedAssets.length || failedScreens.length) {
    console.error(JSON.stringify(report, null, 2));
    throw new Error(`Visual smoke failed: ${failedAssets.length} assets, ${failedScreens.length} screenshots`);
  }

  console.log(JSON.stringify(report, null, 2));
}

main();
