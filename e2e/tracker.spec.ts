import { expect, test } from '@playwright/test'
import { addStarters, open, row, WEDNESDAY_5PM } from './helpers'

test('a browser tab asks to be installed first, then offers starter habits', async ({ page }) => {
  await page.clock.install({ time: new Date(WEDNESDAY_5PM) })
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Add Prometheus to your home screen first' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue in the browser anyway' }).click()
  await expect(page.getByRole('button', { name: 'Add habits' })).toBeDisabled()
  await addStarters(page, ['Gym', 'Study', 'Sleep'])
  await expect(page.getByText('16 – 22 November')).toBeVisible()
  await expect(row(page, 'Gym')).toContainText('0 of 3 days')
  await expect(row(page, 'Study')).toContainText('0m of 10h')
  await expect(row(page, 'Sleep')).toContainText('Nothing logged, aim 7h to 9h')
})

test('a timer keeps counting across a reload and saves on stop', async ({ page }) => {
  await open(page)
  await addStarters(page, ['Gym'])
  await page.getByRole('button', { name: 'Start Gym timer' }).click()
  await expect(page.getByRole('timer')).toBeVisible()

  await page.clock.fastForward('45:00')
  await page.reload()
  await expect(page.getByRole('timer')).toHaveText(/^45:0\d$/)

  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toHaveText(/Saved 45m of Gym/)
  await expect(row(page, 'Gym')).toContainText('1 of 3 days')
  await expect(row(page, 'Gym')).toContainText('45m')
  await expect(page.getByRole('timer')).toBeHidden()
})

test('starting another timer saves the one that was running', async ({ page }) => {
  await open(page)
  await addStarters(page, ['Gym', 'Study'])
  await page.getByRole('button', { name: 'Start Gym timer' }).click()
  await page.clock.fastForward('01:30:00')
  await page.getByRole('button', { name: 'Start Study timer' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toHaveText(/Saved 1h 30m of Gym/)
  await expect(page.getByLabel('Running timer')).toContainText('Study')
  await expect(row(page, 'Gym')).toContainText('1 of 3 days')
})

test('a forgotten timer asks how long it really lasted', async ({ page }) => {
  await open(page)
  await addStarters(page, ['Gym'])
  await page.getByRole('button', { name: 'Start Gym timer' }).click()
  await page.clock.fastForward('06:12:00')

  const prompt = page.getByRole('dialog', { name: 'Timer left running' })
  await expect(prompt.getByRole('heading', { name: 'Still doing Gym?' })).toBeVisible()
  await expect(prompt).toContainText('running for 6h 12m, since 17:00')
  await prompt.getByRole('button', { name: '1.5h' }).click()

  await expect(prompt).toBeHidden()
  await expect(row(page, 'Gym')).toContainText('1h 30m')
  await expect(page.getByRole('timer')).toBeHidden()
})

test('counters, typed values and ticks each log with their own control', async ({ page }) => {
  await open(page)
  await addStarters(page, ['Sleep', 'Water'])

  // Counter: one tap each.
  await page.getByRole('button', { name: 'Add 1 to Water' }).click()
  await page.getByRole('button', { name: 'Add 1 to Water' }).click()
  await expect(row(page, 'Water')).toContainText('2 average, aim 8 glasses or more')

  // Typed duration: the row button opens today's editor.
  await page.getByRole('button', { name: "Log today's Sleep" }).click()
  const sleep = page.getByRole('dialog', { name: 'Sleep' })
  await sleep.getByLabel('Sleep, hours').fill('7')
  await sleep.getByLabel('Sleep, minutes').fill('30')
  await sleep.getByRole('button', { name: 'Save' }).click()
  await sleep.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(row(page, 'Sleep')).toContainText('7h 30m average, aim 7h to 9h')

  // Yes/no: made with the form, since no starter is one.
  await page.getByRole('button', { name: 'Add habit' }).click()
  const form = page.getByRole('dialog', { name: 'New habit' })
  await form.getByLabel('Name').fill('Vitamins')
  await form.getByRole('radio', { name: /Yes or no/ }).click()
  await form.getByLabel('At least').fill('7')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(row(page, 'Vitamins')).toContainText('0 of 7 days')
  await page.getByRole('button', { name: 'Vitamins done today' }).click()
  await expect(row(page, 'Vitamins')).toContainText('1 of 7 days')
})

test('undo takes back the last thing logged', async ({ page }) => {
  await open(page)
  await addStarters(page, ['Water'])
  await page.getByRole('button', { name: 'Add 1 to Water' }).click()
  await expect(row(page, 'Water')).toContainText('1 average')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(row(page, 'Water')).toContainText('0 average')
})

test('an earlier day can be filled in and corrected', async ({ page }) => {
  await open(page)
  await addStarters(page, ['Study'])
  await row(page, 'Study').getByRole('button', { name: /Study/ }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Study' })

  await sheet.getByRole('radio', { name: 'Monday 16 November' }).click()
  await sheet.getByRole('button', { name: '45m', exact: true }).click()
  await sheet.getByRole('button', { name: '1h', exact: true }).click()
  await expect(sheet).toContainText('1h 45m of 10h')

  await sheet.getByRole('button', { name: 'Delete 45m session' }).click()
  await expect(sheet).toContainText('1h of 10h')
  await expect(sheet.getByRole('radio', { name: 'Saturday 21 November' })).toBeDisabled()

  await sheet.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(row(page, 'Study')).toContainText('1h of 10h')
})

test('a new week starts from zero and keeps last week reachable', async ({ page }) => {
  await open(page)
  await addStarters(page, ['Study'])
  await row(page, 'Study').getByRole('button', { name: /Study/ }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Study' })
  await sheet.getByRole('button', { name: '1h', exact: true }).click()
  await sheet.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(row(page, 'Study')).toContainText('1h of 10h')

  // Five days on: Monday 23 November.
  await page.clock.fastForward(5 * 24 * 3600 * 1000)
  await page.reload()
  await expect(page.getByText('23 – 29 November')).toBeVisible()
  await expect(row(page, 'Study')).toContainText('0m of 10h')

  await row(page, 'Study').getByRole('button', { name: /Study/ }).first().click()
  await sheet.getByRole('button', { name: 'Previous week' }).click()
  await expect(sheet).toContainText('16 – 22 November')
  await expect(sheet).toContainText('1h of 10h')
})

test('a goal can be changed and a habit archived and brought back', async ({ page }) => {
  await open(page)
  await addStarters(page, ['Gym'])
  await row(page, 'Gym').getByRole('button', { name: /Gym/ }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Gym' })
  await sheet.getByRole('button', { name: 'Edit' }).click()

  const form = page.getByRole('dialog', { name: 'Edit habit' })
  await form.getByLabel('At least').fill('5')
  await form.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toContainText('0 of 5 days')

  await sheet.getByRole('button', { name: 'Archive habit' }).click()
  await expect(page.getByText('Every habit is archived')).toBeVisible()

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Restore', exact: true }).click()
  await page.getByRole('button', { name: 'Week' }).click()
  await expect(row(page, 'Gym')).toContainText('0 of 5 days')
})

test('a number typed one key at a time keeps its decimal point', async ({ page }) => {
  await open(page)
  await addStarters(page, ['Gym'])
  await page.getByRole('button', { name: 'Add habit' }).click()
  const form = page.getByRole('dialog', { name: 'New habit' })
  await form.getByLabel('Name').fill('Weight')
  await form.getByRole('radio', { name: /Number, typed in/ }).click()
  await form.getByRole('radio', { name: 'No goal' }).click()
  await form.getByRole('button', { name: 'Save' }).click()

  await page.getByRole('button', { name: "Log today's Weight" }).click()
  const sheet = page.getByRole('dialog', { name: 'Weight' })
  await sheet.getByLabel('Weight').pressSequentially('72.5')
  await expect(sheet.getByLabel('Weight')).toHaveValue('72.5')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toContainText('72.5 average')
})

test('clearing a typed value empties its boxes', async ({ page }) => {
  await open(page)
  await addStarters(page, ['Sleep'])
  await page.getByRole('button', { name: "Log today's Sleep" }).click()
  const sheet = page.getByRole('dialog', { name: 'Sleep' })
  await sheet.getByLabel('Sleep, hours').fill('7')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await sheet.getByRole('button', { name: 'Clear' }).click()
  await expect(sheet.getByLabel('Sleep, hours')).toHaveValue('')
  await expect(sheet).toContainText('Nothing logged')
})

test('undo is reachable from inside a habit sheet', async ({ page }) => {
  await open(page)
  await addStarters(page, ['Study'])
  await row(page, 'Study').getByRole('button', { name: /Study/ }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Study' })
  await sheet.getByRole('button', { name: '1h', exact: true }).click()
  await expect(sheet).toContainText('1h of 10h')
  await expect(sheet.getByText('Added 1h to Study')).toBeInViewport()
  await sheet.getByRole('button', { name: 'Undo' }).click()
  await expect(sheet).toContainText('0m of 10h')
})

test('opening a typed habit puts the cursor in its field', async ({ page }) => {
  await open(page)
  await addStarters(page, ['Sleep'])
  await page.getByRole('button', { name: "Log today's Sleep" }).click()
  await expect(page.getByRole('dialog', { name: 'Sleep' }).getByLabel('Sleep, hours')).toBeFocused()
})
