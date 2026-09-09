import "./style.css";
import "./workflow.css";
import "./compact.css";
import "./profile.css";
import initialDemo from "./data/demo.json";
import type { Archive } from "./archive";
import { mountWorkflow } from "./workflow";
import { renderArchiveMarkup } from "./render-panel";

let archive: Archive = initialDemo;
const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;
function renderPage() {
  const markup = renderArchiveMarkup(archive);
  const previous = document.querySelector("main");
  if (previous) {
    const template = document.createElement("template");
    template.innerHTML = markup;
    previous.replaceWith(template.content.querySelector("main")!);
  } else document.querySelector<HTMLDivElement>("#app")!.innerHTML = markup;
  document.querySelectorAll<HTMLImageElement>("main img").forEach((img) =>
    img.addEventListener(
      "error",
      () => {
        img.src = asset("assets/jacket-fallback.svg");
      },
      { once: true },
    ),
  );
}
renderPage();
mountWorkflow(
  () => archive,
  (next) => {
    archive = next;
    renderPage();
  },
);

function setTheme(theme: string) {
  const value = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = value;
  document
    .querySelectorAll<HTMLButtonElement>("button[data-theme]")
    .forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.theme === value),
      );
    });
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", value === "dark" ? "#15121e" : "#f0edf4");
}
try {
  setTheme(localStorage.getItem("arcaea-theme") ?? "dark");
} catch {
  setTheme("dark");
}
document
  .querySelectorAll<HTMLButtonElement>("button[data-theme]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      setTheme(button.dataset.theme!);
      try {
        localStorage.setItem("arcaea-theme", button.dataset.theme!);
      } catch {
        /* Private browsing may disable storage. */
      }
    });
  });
