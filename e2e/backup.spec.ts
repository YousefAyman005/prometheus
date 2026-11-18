import { readFile, writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

// Desktop Chrome has a share sheet that cannot be driven from a test, so these runs take
// the browser-tab path (a download). The share-sheet path is checked by hand on an iPhone.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined })
  })
})

test('data survives a reload', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add a sample habit' }).click()
  await page.getByRole('button', { name: 'Add a sample habit' }).click()
  await expect(page.getByText('Sample habit 1, Sample habit 2')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Sample habit 1, Sample habit 2')).toBeVisible()
})

test('a backup restores everything after the data is erased', async ({ page }, testInfo) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add a sample habit' }).click()
  await page.getByRole('button', { name: 'Add a sample habit' }).click()
  await expect(page.getByRole('button', { name: /Back up now/ })).toContainText('Never')

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: /Back up now/ }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^prometheus-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = testInfo.outputPath('backup.json')
  await download.saveAs(path)
  const backup = JSON.parse(await readFile(path, 'utf8'))
  expect(backup.format).toBe('prometheus-backup')
  expect(Object.keys(backup.data.habits)).toHaveLength(2)
  await expect(page.getByRole('status')).toContainText('Backed up')
  await expect(page.getByRole('button', { name: /Back up now/ })).not.toContainText('Never')

  await page.getByRole('button', { name: 'Erase all data' }).click()
  await page.getByRole('button', { name: 'Erase', exact: true }).click()
  await expect(page.getByText('Nothing stored yet')).toBeVisible()

  await page.locator('input[type=file]').setInputFiles(path)
  await expect(page.getByRole('heading', { name: 'Replace everything on this phone?' })).toBeVisible()
  await expect(page.getByText(/holds 2 habits and 2 logged entries/)).toBeVisible()
  await page.getByRole('button', { name: 'Replace with backup' }).click()
  await expect(page.getByText('Sample habit 1, Sample habit 2')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Restored 2 habits and 2 logged entries.')
})

test('cancelling a restore changes nothing', async ({ page }, testInfo) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Add a sample habit' }).click()
  const path = testInfo.outputPath('empty-backup.json')
  await writeFile(path, JSON.stringify({
    format: 'prometheus-backup', schemaVersion: 1, exportedAt: '2026-01-02T10:00:00.000Z', appVersion: '0.1.0',
    data: { schemaVersion: 1, habits: {}, groups: {}, entries: {}, runningTimer: null, pauses: {}, celebrated: {}, settings: {} },
  }))
  await page.locator('input[type=file]').setInputFiles(path)
  await expect(page.getByText(/backup from 2 Jan 2026 holds 0 habits/)).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('Sample habit 1')).toBeVisible()
})

test('a file that is not a backup is refused with a reason', async ({ page }, testInfo) => {
  await page.goto('./')
  const path = testInfo.outputPath('holiday.json')
  await writeFile(path, JSON.stringify({ photos: ['beach.jpg'] }))
  await page.locator('input[type=file]').setInputFiles(path)
  await expect(page.getByRole('status')).toHaveText('This file is not a Prometheus backup.')
})
