import { expect, test } from "@playwright/test";

test("renders the approved 4K dashboard and API contract", async ({
  page,
  request,
}) => {
  const healthResponse = await request.get("/api/health");
  expect(healthResponse.ok()).toBe(true);

  const dashboardResponse = await request.get("/api/dashboard");
  expect(dashboardResponse.ok()).toBe(true);
  const dashboard = (await dashboardResponse.json()) as {
    systems: unknown[];
    unifi: unknown;
    k3s: { nodes: unknown[] };
    devices: { status: "up" | "down" | "unknown"; url?: string }[];
    links: unknown[];
  };
  expect(dashboard.systems).toHaveLength(2);
  expect(dashboard.unifi).toBeTruthy();
  expect(dashboard.k3s).toBeTruthy();
  expect(dashboard.devices).toHaveLength(8);
  expect(dashboard.links).toHaveLength(0);

  await page.goto("/");

  for (const sectionTitle of [
    "Network",
    "Core systems",
    "LAN workloads",
    "K3s cluster",
  ]) {
    await expect(
      page.getByRole("heading", { name: sectionTitle }),
    ).toBeAttached();
    await expect(page.getByRole("heading", { name: sectionTitle })).toHaveCSS(
      "clip-path",
      "inset(50%)",
    );
  }
  await expect(
    page.getByRole("heading", { name: "Proxmox", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Unraid", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "UniFi", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".k3s-system-card")
      .getByRole("heading", { name: "K3s", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-system-logo]")).toHaveCount(4);
  await expect(page.locator(".k3s-system-card .metric-panel")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Quick links" })).toHaveCount(
    0,
  );
  await expect(page.locator(".quick-link-card")).toHaveCount(0);
  const serviceLogos = page.locator("[data-service-logo]");
  await expect(serviceLogos).toHaveCount(7);
  expect(
    await serviceLogos.evaluateAll((logos) =>
      logos.map((logo) => logo.getAttribute("data-service-logo")),
    ),
  ).toEqual([
    "samba",
    "vercelab",
    "bladevault-backend",
    "gitea",
    "mysql",
    "k3s",
    "bladevault-unraid",
  ]);
  await expect(
    page.locator(".system-header").getByText("Online", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("2.5G", { exact: true })).toHaveCount(0);
  await expect(
    page.locator(".device-card").getByText("CPU", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator(".device-card").getByText("MEM", { exact: true }),
  ).toHaveCount(0);
  const statusLabels = page.locator(".device-status > span");
  for (const [index, device] of dashboard.devices.entries()) {
    if (device.status === "up") {
      await expect(statusLabels.nth(index)).toHaveCSS(
        "color",
        "rgb(22, 134, 75)",
      );
    } else if (device.status === "down") {
      await expect(statusLabels.nth(index)).toHaveCSS(
        "color",
        "rgb(199, 55, 55)",
      );
    }
  }
  const copyIpButtons = page.getByRole("button", {
    name: /Copy .* IP address/,
  });
  await expect(copyIpButtons).toHaveCount(dashboard.devices.length);
  await copyIpButtons.first().click();
  await expect(page.getByRole("button", { name: /IP copied$/ })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(
    dashboard.devices.length + 4,
  );
  await expect(
    page.getByRole("link", { name: /Open .* in a new window/ }),
  ).toHaveCount(
    dashboard.devices.filter((device) => device.url).length +
      dashboard.links.length,
  );

  const layout = await page.evaluate(() => {
    const topbar = document.querySelector(".topbar");
    const topbarInner = document.querySelector(".topbar-inner");
    const footerInner = document.querySelector(".footer-inner");
    const systemHeaders = [...document.querySelectorAll(".system-header")];
    const sections = [...document.querySelectorAll(".dashboard-section")];

    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      topbarInnerHeight: topbarInner!.getBoundingClientRect().height,
      footerInnerHeight: footerInner!.getBoundingClientRect().height,
      statusTextSizes: [
        ...document.querySelectorAll(".status-cluster > *"),
      ].map((item) => Number.parseFloat(getComputedStyle(item).fontSize)),
      systemHeaderHeights: systemHeaders.map(
        (header) => header.getBoundingClientRect().height,
      ),
      systemLogoInsets: systemHeaders.map((header) => {
        const headerBounds = header.getBoundingClientRect();
        const logoBounds = header
          .querySelector(".system-glyph")!
          .getBoundingClientRect();
        return {
          top: logoBounds.top - headerBounds.top,
          bottom: headerBounds.bottom - logoBounds.bottom,
        };
      }),
      deviceCardHeights: [...document.querySelectorAll(".device-card")].map(
        (card) => card.getBoundingClientRect().height,
      ),
      deviceActionSizes: [...document.querySelectorAll(".device-actions")].map(
        (actions) =>
          [...actions.querySelectorAll("a, button")].map((action) => {
            const bounds = action.getBoundingClientRect();
            return { width: bounds.width, height: bounds.height };
          }),
      ),
      headerGap:
        sections[0].getBoundingClientRect().top -
        topbar!.getBoundingClientRect().bottom,
      sectionGaps: sections
        .slice(1)
        .map(
          (section, index) =>
            section.getBoundingClientRect().top -
            sections[index].getBoundingClientRect().bottom,
        ),
    };
  });

  expect(layout.documentWidth).toBe(layout.viewportWidth);
  expect(layout.documentHeight).toBeLessThanOrEqual(2160);
  expect(layout.topbarInnerHeight).toBe(35);
  expect(layout.footerInnerHeight).toBe(29);
  expect(layout.statusTextSizes).toEqual([8, 8]);
  expect(layout.systemHeaderHeights).toEqual([58, 58, 58, 58]);
  expect(layout.systemLogoInsets).toEqual([
    { top: 12, bottom: 12 },
    { top: 12, bottom: 12 },
    { top: 12, bottom: 12 },
    { top: 12, bottom: 12 },
  ]);
  expect(layout.deviceCardHeights.every((height) => height <= 90)).toBe(true);
  expect(
    layout.deviceActionSizes.every((sizes) =>
      sizes.every(({ width, height }) => width === 14 && height === 14),
    ),
  ).toBe(true);
  expect(layout.headerGap).toBe(5);
  expect(layout.sectionGaps).toEqual([5, 5, 5]);
});
