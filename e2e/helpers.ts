import { expect, type Page } from '@playwright/test'

/** Wednesday 18 November 2026, 17:00 in Berlin: midweek, well clear of the 04:00 day end. */
export const WEDNESDAY_5PM = '2026-11-18T17:00:00+01:00'

/** Opens the app at a known moment and gets past the "install first" page shown in a browser tab. */
export async function open(page: Page, time: string = WEDNESDAY_5PM) {
  await page.clock.install({ time: new Date(time) })
  await page.goto('./')
  await page.getByRole('button', { name: 'Continue in the browser anyway' }).click()
}

/** Adds starter habits by name from the first-run screen. */
export async function addStarters(page: Page, names: string[]) {
  for (const name of names) await page.getByRole('checkbox', { name: new RegExp(`^${name}`) }).click()
  await page.getByRole('button', { name: /^Add \d+ habits?$/ }).click()
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible()
}

/** The row of a habit on the week screen. */
export function row(page: Page, name: string) {
  return page.getByRole('listitem').filter({ hasText: name })
}
