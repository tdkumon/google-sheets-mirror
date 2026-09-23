document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("search-input");
  const clearBtn = document.getElementById("clear-filter-btn");

  if (searchInput) searchInput.value = "";

  if (clearBtn) {
    clearBtn.addEventListener("click", clearFilter);
  }

  document.getElementById("table-container").addEventListener("click", (e) => {
    const titleSpan = e.target.closest(".title-clickable");
    if (!titleSpan) return;

    const rawTitle = titleSpan.textContent.trim();
    const titleOnly = cleanTitle(rawTitle);

    const wrapper = document.getElementById("search-wrapper");

    if (searchInput) {
      searchInput.value = titleOnly;
      searchInput.style.width = `${Math.max(titleOnly.length + 2, 8)}ch`;
    }

    if (wrapper) {
      wrapper.classList.add("title-active");
    }

    handleSearch();
  });

  fetch("../progresslog-last-updated.txt?v=" + Date.now())
    .then((response) => response.text())
    .then((timestamp) => {
      const badge = document.getElementById("last-updated");
      if (badge) {
        badge.textContent = `Last updated: ${formatUTCToLocal(timestamp)}`;
      }
    })
    .catch(() => {
      const badge = document.getElementById("last-updated");
      if (badge) badge.style.display = "none";
    });

  Papa.parse("../progresslog.csv", {
    download: true,
    skipEmptyLines: true,
    complete: function (results) {
      renderProgressLog(results.data);
    },
    error: function () {
      document.getElementById("table-container").innerHTML =
        '<div class="no-results">Failed to load progress log CSV data.</div>';
    },
  });
});

function cleanTitle(fullTitle) {
  let cleaned = fullTitle
    .replace(
      /^.*?\b(finished|played|read|watched|started|dropped|restarted)\b\s*/i,
      "",
    )
    .trim();

  const allowedMediaRegex = /\b(Anime|Manga|Light Novel|VN|Book)\b/i;

  cleaned = cleaned.replace(/\s*\(([^)]*)\)/g, (match, innerContent) => {
    if (allowedMediaRegex.test(innerContent)) {
      return ` (${innerContent.trim()})`;
    }
    return "";
  });

  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned || fullTitle;
}

function handleManualInput() {
  const searchInput = document.getElementById("search-input");
  const wrapper = document.getElementById("search-wrapper");

  if (wrapper) {
    wrapper.classList.remove("title-active");
  }
  if (searchInput) {
    searchInput.style.removeProperty("width");
  }

  handleSearch();
}

function clearFilter() {
  const searchInput = document.getElementById("search-input");
  const wrapper = document.getElementById("search-wrapper");

  if (searchInput) {
    searchInput.value = "";
    searchInput.style.removeProperty("width");
  }
  if (wrapper) {
    wrapper.classList.remove("title-active");
  }

  handleSearch();
}

function formatUTCToLocal(utcString) {
  const match = utcString
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!match) return utcString;

  const [, day, month, year, hours, minutes] = match;
  const isoString = `${year}-${month}-${day}T${hours}:${minutes}:00Z`;
  const dateObj = new Date(isoString);

  if (isNaN(dateObj.getTime())) return utcString;

  return dateObj.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderProgressLog(rows) {
  const container = document.getElementById("table-container");
  container.innerHTML = "";

  let activeYear = "2026";
  let currentMonthTitle = "";
  let monthSections = [];
  let currentDayBlock = null;

  rows.forEach((row) => {
    const col1 = (row[1] || "").trim();
    const col2 = (row[2] || "").trim();
    const col3 = (row[3] || "").trim();
    const col4 = (row[4] || "").trim();
    const col5 = (row[5] || "").trim();

    if (col1.match(/^[A-Za-z]+\s+\d{4}$/)) {
      currentMonthTitle = col1;
      const yearMatch = col1.match(/\d{4}$/);
      if (yearMatch) activeYear = yearMatch[0];

      currentDayBlock = null;
      monthSections.push({
        month: currentMonthTitle,
        dayBlocks: [],
      });
      return;
    }

    if (
      !col2 ||
      col1.toLowerCase() === "date" ||
      col2.toLowerCase() === "title"
    ) {
      return;
    }

    if (monthSections.length === 0) return;
    const currentSection = monthSections[monthSections.length - 1];

    if (col1 !== "") {
      currentDayBlock = {
        date: col1,
        entries: [],
      };
      currentSection.dayBlocks.push(currentDayBlock);
    }

    if (currentDayBlock) {
      currentDayBlock.entries.push({
        title: col2,
        progress: col3,
        note: col4,
        comment: col5,
      });
    }
  });

  monthSections.forEach((section) => {
    const sectionTitle = document.createElement("div");
    sectionTitle.className = "section-title";
    sectionTitle.textContent = section.month;
    container.appendChild(sectionTitle);

    const table = document.createElement("table");
    table.innerHTML = `
      <thead>
        <tr>
          <th class="col-date">date</th>
          <th class="col-title">title</th>
          <th class="col-meta">
            progress
            <div class="comment-corner-mark"></div>
            <div class="comment-popover">
              <div class="comment-popover-header">COMMENT</div>
              <div class="comment-popover-body">if there are two values in two lines (like episode 1 in one line, then episode 2 in the next), it means i slept in between (like i watched episode 1 at 2 AM, went to sleep, then watched episode 2 some time after i woke up, but still on the same date)</div>
            </div>
          </th>
          <th class="col-extra">note</th>
        </tr>
      </thead>
    `;

    const tbody = document.createElement("tbody");

    section.dayBlocks.forEach((block) => {
      const rowCount = block.entries.length;

      block.entries.forEach((entry, index) => {
        const tr = document.createElement("tr");
        const isFirst = index === 0;

        tr.className = isFirst ? "day-start" : "day-entry";

        let html = "";
        if (isFirst) {
          html += `<td class="col-date" rowspan="${rowCount}">${block.date}</td>`;
        }

        html += `
          <td class="col-title">${formatTitle(entry.title)}</td>
          <td class="col-meta">${escapeHTML(entry.progress)}</td>
          <td class="col-extra">${renderNoteCell(entry.note, entry.comment)}</td>
        `;

        tr.innerHTML = html;
        tbody.appendChild(tr);
      });
    });

    table.appendChild(tbody);
    container.appendChild(table);
  });

  document.body.setAttribute("data-year", activeYear);
}

function renderNoteCell(note, comment) {
  const escapedNote = escapeHTML(note);
  if (!comment) return escapedNote;

  const escapedComment = escapeHTML(comment);
  const isLong = comment.length > 150 || comment.split("\n").length > 3;

  return `${escapedNote}<div class="comment-corner-mark"></div><div class="comment-popover"><div class="comment-popover-header">Comment</div><div class="comment-popover-body ${isLong ? "is-truncated" : ""}">${escapedComment}</div>${isLong ? `<button type="button" class="comment-expand-btn" onclick="toggleCommentExpand(this, event)">Show more</button>` : ""}</div>`;
}

function toggleCommentExpand(btn, event) {
  event.stopPropagation();
  const body = btn.previousElementSibling;
  if (body.classList.contains("is-truncated")) {
    body.classList.remove("is-truncated");
    btn.textContent = "Show less";
  } else {
    body.classList.add("is-truncated");
    btn.textContent = "Show more";
  }
}

function handleSearch() {
  const query = document
    .getElementById("search-input")
    .value.toLowerCase()
    .trim();
  const tables = document.querySelectorAll("#table-container table");

  tables.forEach((table) => {
    let tableHasMatches = false;
    const tbodies = table.querySelectorAll("tbody");

    tbodies.forEach((tbody) => {
      const dayStartRows = tbody.querySelectorAll("tr.day-start");

      dayStartRows.forEach((startRow) => {
        if (!startRow.hasAttribute("data-original-rowspan")) {
          const initialDateCell = startRow.querySelector(".col-date");
          if (initialDateCell) {
            startRow.setAttribute(
              "data-original-rowspan",
              initialDateCell.getAttribute("rowspan") || "1",
            );
          }
        }

        const originalRowspan = parseInt(
          startRow.getAttribute("data-original-rowspan") || "1",
          10,
        );

        const dayRows = [startRow];
        let nextRow = startRow.nextElementSibling;
        for (let i = 1; i < originalRowspan && nextRow; i++) {
          dayRows.push(nextRow);
          nextRow = nextRow.nextElementSibling;
        }

        let dateCell = null;
        dayRows.forEach((row) => {
          const found = row.querySelector(".col-date");
          if (found) dateCell = found;
        });

        let visibleCount = 0;
        let firstVisibleRow = null;

        dayRows.forEach((row) => {
          const titleCell = row.querySelector(".col-title");
          const titleText = titleCell
            ? titleCell.textContent.toLowerCase()
            : "";

          if (query === "" || titleText.includes(query)) {
            row.style.display = "";
            visibleCount++;
            if (!firstVisibleRow) firstVisibleRow = row;
          } else {
            row.style.display = "none";
          }
        });

        if (visibleCount > 0) {
          tableHasMatches = true;
          if (dateCell && firstVisibleRow) {
            dateCell.setAttribute("rowspan", visibleCount);
            if (dateCell.parentElement !== firstVisibleRow) {
              firstVisibleRow.insertBefore(
                dateCell,
                firstVisibleRow.firstChild,
              );
            }
          }
        }
      });
    });

    const title = table.previousElementSibling;
    if (!tableHasMatches && query !== "") {
      table.style.display = "none";
      if (title && title.classList.contains("section-title")) {
        title.style.display = "none";
      }
    } else {
      table.style.display = "";
      if (title && title.classList.contains("section-title")) {
        title.style.display = "";
      }
    }
  });
}

function formatTitle(title) {
  const escaped = escapeHTML(title);
  const hasKeyword =
    /\b(finished|played|read|watched|started|dropped|restarted)\b/i.test(title);

  const formatted = escaped
    .replace(
      /\b(finished|played|read|watched)\b/gi,
      '<span class="kw-green">$1</span>',
    )
    .replace(/\b(started|restarted)\b/gi, '<span class="kw-blue">$1</span>')
    .replace(/\b(dropped)\b/gi, '<span class="kw-red">$1</span>');

  const content = hasKeyword
    ? `<span class="title-bold">${formatted}</span>`
    : formatted;
  return `<span class="title-clickable">${content}</span>`;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

window.clearFilter = clearFilter;
window.handleManualInput = handleManualInput;
window.toggleCommentExpand = toggleCommentExpand;
