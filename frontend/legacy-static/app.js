const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".flow-board");
const searchInput = document.querySelector("#schoolSearch");
const applicationRows = document.querySelectorAll("#applicationRows tr");
const todayLabel = document.querySelector("#todayLabel");

const formatter = new Intl.DateTimeFormat("en-KE", {
  weekday: "long",
  month: "short",
  day: "numeric",
  year: "numeric",
});

todayLabel.textContent = formatter.format(new Date());

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;

    tabs.forEach((item) => item.classList.toggle("active", item === tab));
    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panel === target);
    });
  });
});

searchInput.addEventListener("input", (event) => {
  const query = event.target.value.trim().toLowerCase();

  applicationRows.forEach((row) => {
    const matches = row.textContent.toLowerCase().includes(query);
    row.hidden = query.length > 0 && !matches;
  });
});
