import { readFile, writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { addStarters, open, row } from './helpers'

// Desktop Chrome has a share sheet that cannot be driven from a test, so these runs take
// the browser-tab path (a download). The share-sheet path is checked by hand on an iPhone.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined })
  })
})

test('what is logged survives a reload', async ({ page }) => {
  await open(page)
  await addStarters(page, ['Water'])
  await page.getByRole('button', { name: 'Add 1 to Water' }).click()
  await page.reload()
  await expect(row(page, 'Water')).toContainText('1 average')
})

test('a backup restores everything after the data is erased', async ({ page }, testInfo) => {
  await open(page)
  await addStarters(page, ['Gym', 'Water'])
  await page.getByRole('button', { name: 'Add 1 to Water' }).click()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('button', { name: /Back up now/ })).toContainText('Never')

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: /Back up now/ }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('prometheus-backup-2026-11-18.json')
  const path = testInfo.outputPath('backup.json')
  await download.saveAs(path)
  const backup = JSON.parse(await readFile(path, 'utf8'))
  expect(backup.format).toBe('prometheus-backup')
  expect(Object.keys(backup.data.habits)).toHaveLength(2)
  await expect(page.getByText('Backed up. The file is in your downloads.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Back up now/ })).toContainText('18 Nov 2026')

  await page.getByRole('button', { name: 'Erase all data' }).click()
  await page.getByRole('button', { name: 'Erase', exact: true }).click()
  await page.getByRole('button', { name: 'Week' }).click()
  await expect(page.getByRole('button', { name: 'Add habits' })).toBeVisible()

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.locator('input[type=file]').setInputFiles(path)
  await expect(page.getByRole('heading', { name: 'Replace everything on this phone?' })).toBeVisible()
  await expect(page.getByText(/holds 2 habits and 1 logged entry/)).toBeVisible()
  await page.getByRole('button', { name: 'Replace with backup' }).click()
  await expect(page.getByText('Restored 2 habits and 1 logged entry.')).toBeVisible()

  await page.getByRole('button', { name: 'Week' }).click()
  await expect(row(page, 'Water')).toContainText('1 average')
  await expect(row(page, 'Gym')).toBeVisible()
})

test('cancelling a restore changes nothing', async ({ page }, testInfo) => {
  await open(page)
  await addStarters(page, ['Gym'])
  const path = testInfo.outputPath('empty-backup.json')
  await writeFile(path, JSON.stringify({
    format: 'prometheus-backup', schemaVersion: 1, exportedAt: '2026-01-02T10:00:00.000Z', appVersion: '0.1.0',
    data: { schemaVersion: 1, habits: {}, groups: {}, entries: {}, runningTimer: null, pauses: {}, celebrated: {}, settings: {} },
  }))
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.locator('input[type=file]').setInputFiles(path)
  await expect(page.getByText(/backup from 2 Jan 2026 holds 0 habits/)).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: 'Week' }).click()
  await expect(row(page, 'Gym')).toBeVisible()
})

test('a file that is not a backup is refused with a reason', async ({ page }, testInfo) => {
  await open(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  const path = testInfo.outputPath('holiday.json')
  await writeFile(path, JSON.stringify({ photos: ['beach.jpg'] }))
  await page.locator('input[type=file]').setInputFiles(path)
  await expect(page.getByText('This file is not a Prometheus backup.')).toBeVisible()
})
