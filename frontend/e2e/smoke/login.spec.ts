import { expect, test } from '@playwright/test'

test('login page renders and account mode toggle works', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()
  await expect(page.getByRole('textbox').first()).toBeVisible()

  await page.getByRole('button', { name: 'Parent Login' }).click()

  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})
