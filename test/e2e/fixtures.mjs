import {test as base, expect} from "@playwright/test";

// Console errors that come from the headless environment, not from nunuStudio
const ignored = [/favicon\.ico/, /GPU stall due to ReadPixels/, /user gesture is required to request Pointer Lock/];

/**
 * Page fixture that records page errors, console errors and alert/confirm/prompt dialogs.
 *
 * Every test fails if anything was recorded, use expectClean(page) to check at a specific point.
 */
export const test = base.extend({
	// Runtime script used by the harness, set per project in playwright.config.mjs
	runtime: ["/nunu.min.js", {option: true}],
	// Fail tests on page problems, when false they are only reported as annotations
	strict: [true, {option: true}],

	page: async ({page, strict}, use, testInfo) =>
	{
		page.problems = [];
		page.on("pageerror", (error) =>
		{
			if (!ignored.some((re) => re.test(error.message)))
			{
				page.problems.push(`page error: ${error.message} ${(error.stack || "").split("\n")[1]?.trim() ?? ""}`);
			}
		});
		page.on("console", (message) =>
		{
			if (message.type() === "error" && !ignored.some((re) => re.test(message.text())))
			{
				page.problems.push(`console error: ${message.text()}`);
			}
		});
		page.on("dialog", async (dialog) =>
		{
			page.problems.push(`${dialog.type()}: ${dialog.message()}`);
			await dialog.dismiss();
		});

		await use(page);
		if (strict)
		{
			expectClean(page);
		}
		else
		{
			page.problems.forEach((problem) => testInfo.annotations.push({type: "problem", description: problem}));
		}
	}
});

export function expectClean(page)
{
	expect(page.problems, "page errors, console errors or dialogs").toEqual([]);
}

/**
 * Deterministic Math.random, also exposes window.seededRandom(seed) to create independent streams.
 */
export async function seedRandom(page, seed = 1)
{
	await page.addInitScript((initial) =>
	{
		window.seededRandom = function(s)
		{
			return function()
			{
				s = s + 0x6D2B79F5 | 0;
				var t = Math.imul(s ^ s >>> 15, 1 | s);
				t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
				return ((t ^ t >>> 14) >>> 0) / 4294967296;
			};
		};
		Math.random = window.seededRandom(initial);
	}, seed);
}

export {expect};
