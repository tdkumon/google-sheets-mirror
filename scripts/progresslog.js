window.progressLogMetadata = {};

document.addEventListener("DOMContentLoaded", () => {
  const tableContainer = document.getElementById("table-container");

  if (tableContainer) {
    let activePopover = null;
    let activeCell = null;

    function showPopover(cell) {
      const popover = cell.querySelector(".comment-popover");
      if (!popover) return;

      const popoverBody = popover.querySelector(
        ".comment-popover-body.is-truncated",
      );
      if (popoverBody) popoverBody.scrollTop = 0;

      popover.style.display = "block";
      const rect = cell.getBoundingClientRect();
      const popoverHeight = popover.offsetHeight;
      const windowHeight = window.innerHeight;

      popover.style.position = "fixed";
      popover.style.right = window.innerWidth - rect.right + "px";
      popover.style.left = "auto";
      popover.style.width = "300px";

      if (
        rect.bottom + popoverHeight > windowHeight - 10 &&
        rect.top > popoverHeight + 10
      ) {
        popover.style.top = rect.top - popoverHeight + "px";
      } else {
        popover.style.top = rect.bottom + "px";
      }

      popover.classList.add("is-active-fixed");
      activePopover = popover;
      activeCell = cell;
    }

    function hidePopover() {
      if (!activePopover) return;
      activePopover.classList.remove("is-active-fixed");
      activePopover.style.display = "";
      activePopover.style.position = "";
      activePopover.style.left = "";
      activePopover.style.right = "";
      activePopover.style.top = "";
      activePopover.style.width = "";
      activePopover = null;
      activeCell = null;
    }

    tableContainer.addEventListener("mouseover", (e) => {
      const cell = e.target.closest("td.col-extra");
      if (cell && activeCell !== cell) {
        hidePopover();
        showPopover(cell);
      }
    });

    tableContainer.addEventListener("mouseout", (e) => {
      const cell = e.target.closest("td.col-extra");
      const popover = e.target.closest(".comment-popover");
      const related = e.relatedTarget;

      if (cell || popover) {
        if (related) {
          if (activeCell && activeCell.contains(related)) return;
          if (activePopover && activePopover.contains(related)) return;
        }
        hidePopover();
      }
    });
  }

  window.addEventListener("beforeunload", () => {
    document.querySelectorAll(".comment-popover-body").forEach((body) => {
      body.scrollTop = 0;
    });
  });

  const searchInput = document.getElementById("search-input");
  const clearBtn = document.getElementById("clear-filter-btn");

  if (searchInput) searchInput.value = "";

  if (clearBtn) {
    clearBtn.addEventListener("click", clearFilter);
  }

  document.getElementById("table-container").addEventListener("click", (e) => {
    const titleSpan = e.target.closest(".title-clickable");
    if (!titleSpan) return;

    const row = titleSpan.closest("tr");
    if (!row) return;
    const entryId = row.getAttribute("data-id");
    if (!entryId) return;

    const searchInput = document.getElementById("search-input");
    const searchWrapper = document.getElementById("search-wrapper");
    const filterBanner = document.getElementById("filter-banner");
    const bannerText = document.getElementById("filter-banner-text");

    if (searchInput) {
      searchInput.setAttribute("data-filtered-id", entryId);
    }

    const meta = window.progressLogMetadata[entryId] || {
      cleanTitle: cleanTitle(titleSpan.textContent.trim()),
      sessions: 1,
      firstDate: "Unknown",
    };

    if (bannerText) {
      bannerText.innerHTML = `Showing entries for <strong>${escapeHTML(meta.cleanTitle)}</strong> (ID #${entryId}) &bull; ${meta.sessions} session${meta.sessions > 1 ? "s" : ""} &bull; First logged: ${escapeHTML(meta.firstDate)}`;
    }

    if (searchWrapper) searchWrapper.style.display = "none";
    if (filterBanner) filterBanner.style.display = "flex";

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
  const searchWrapper = document.getElementById("search-wrapper");
  const filterBanner = document.getElementById("filter-banner");

  if (searchInput) {
    searchInput.removeAttribute("data-filtered-id");
  }

  if (searchWrapper) searchWrapper.style.display = "flex";
  if (filterBanner) filterBanner.style.display = "none";

  handleSearch();
}

function clearFilter() {
  const searchInput = document.getElementById("search-input");
  const searchWrapper = document.getElementById("search-wrapper");
  const filterBanner = document.getElementById("filter-banner");

  if (searchInput) {
    searchInput.value = "";
    searchInput.removeAttribute("data-filtered-id");
    searchInput.style.removeProperty("width");
  }

  if (searchWrapper) searchWrapper.style.display = "flex";
  if (filterBanner) filterBanner.style.display = "none";

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

function updateFirstVisibleSection() {
  const titles = document.querySelectorAll("#table-container .section-title");
  let firstFound = false;
  titles.forEach((title) => {
    if (title.style.display !== "none") {
      if (!firstFound) {
        title.classList.add("is-first-visible");
        firstFound = true;
      } else {
        title.classList.remove("is-first-visible");
      }
    } else {
      title.classList.remove("is-first-visible");
    }
  });
}

function renderProgressLog(rows) {
  const container = document.getElementById("table-container");
  container.innerHTML = "";
  window.progressLogMetadata = {};

  let activeYear = "2026";
  let currentMonthTitle = "";
  let monthSections = [];
  let currentDayBlock = null;

  rows.forEach((row) => {
    const colId = (row[0] || "").trim();
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
      col2.toLowerCase() === "title" ||
      colId.toLowerCase() === "id"
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

    if (currentDayBlock && currentDayBlock.date) {
      const entryDateStr = `${currentDayBlock.date} ${currentMonthTitle}`;

      if (colId) {
        if (!window.progressLogMetadata[colId]) {
          window.progressLogMetadata[colId] = {
            cleanTitle: cleanTitle(col2),
            sessions: 0,
            firstDate: entryDateStr,
          };
        }
        window.progressLogMetadata[colId].sessions += 1;
        window.progressLogMetadata[colId].firstDate = entryDateStr;
      }

      currentDayBlock.entries.push({
        id: colId,
        title: col2,
        progress: col3,
        note: col4,
        comment: col5,
      });
    }
  });

  monthSections.forEach((section, sIndex) => {
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

    section.dayBlocks.forEach((block, dIndex) => {
      const rowCount = block.entries.length;
      const dayGroupId = `s${sIndex}-d${dIndex}`;

      block.entries.forEach((entry, index) => {
        const tr = document.createElement("tr");
        const isFirst = index === 0;
        const isLast = index === rowCount - 1;

        tr.setAttribute("data-day-group", dayGroupId);

        let classList = [];
        if (isFirst) classList.push("day-start");
        else classList.push("day-entry");
        if (isLast) classList.push("day-end");

        tr.className = classList.join(" ");
        if (entry.id) {
          tr.setAttribute("data-id", entry.id);
        }

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
  updateFirstVisibleSection();
  document.body.setAttribute("data-year", activeYear);
}

function renderNoteCell(note, comment) {
  const escapedNote = escapeHTML(note);
  if (!comment) return escapedNote;

  const escapedComment = escapeHTML(comment);
  const isLong = comment.length > 150 || comment.split("\n").length > 3;

  return `${escapedNote}<div class="comment-corner-mark"></div><div class="comment-popover"><div class="comment-popover-header"><span>Comment</span><button type="button" class="comment-fullscreen-btn" onclick="openCommentModal(this, event)">⛶</button></div><div class="comment-popover-body ${isLong ? "is-truncated" : ""}">${escapedComment}</div>${isLong ? `<button type="button" class="comment-expand-btn" onclick="toggleCommentExpand(this, event)">Show more</button>` : ""}</div>`;
}

function toggleCommentExpand(btn, event) {
  event.stopPropagation();
  const body = btn.previousElementSibling;
  if (body.classList.contains("is-truncated")) {
    body.classList.remove("is-truncated");
    body.classList.add("is-expanded");
    btn.textContent = "Show less";
  } else {
    body.classList.remove("is-expanded");
    body.classList.add("is-truncated");
    body.scrollTop = 0;
    btn.textContent = "Show more";
  }
}

function handleSearch() {
  const searchInput = document.getElementById("search-input");
  const query = searchInput.value.toLowerCase().trim();
  const activeIdFilter = searchInput.getAttribute("data-filtered-id");
  const tables = document.querySelectorAll("#table-container table");

  tables.forEach((table) => {
    let tableHasMatches = false;
    const tbodies = table.querySelectorAll("tbody");

    tbodies.forEach((tbody) => {
      const groupMap = new Map();
      tbody.querySelectorAll("tr[data-day-group]").forEach((row) => {
        const groupId = row.getAttribute("data-day-group");
        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, []);
        }
        groupMap.get(groupId).push(row);
      });

      groupMap.forEach((dayRows) => {
        let dateCell = null;
        dayRows.forEach((row) => {
          const found = row.querySelector(".col-date");
          if (found) dateCell = found;
        });

        let visibleCount = 0;
        let firstVisibleRow = null;
        let visibleRows = [];

        dayRows.forEach((row) => {
          const rowId = row.getAttribute("data-id") || "";
          const titleCell = row.querySelector(".col-title");
          const titleText = titleCell
            ? titleCell.textContent.toLowerCase()
            : "";

          let isMatch = false;

          if (activeIdFilter) {
            isMatch = rowId === activeIdFilter;
          } else {
            isMatch = query === "" || titleText.includes(query);
          }

          if (isMatch) {
            row.style.display = "";
            visibleCount++;
            visibleRows.push(row);
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

          visibleRows.forEach((row, idx) => {
            row.classList.remove("day-start", "day-entry", "day-end");

            const isFirstVisible = idx === 0;
            const isLastVisible = idx === visibleRows.length - 1;

            if (isFirstVisible) {
              row.classList.add("day-start");
            } else {
              row.classList.add("day-entry");
            }

            if (isLastVisible) {
              row.classList.add("day-end");
            }
          });
        }
      });
    });

    const title = table.previousElementSibling;
    if (!tableHasMatches && (query !== "" || activeIdFilter)) {
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

  updateFirstVisibleSection();
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

function initCommentModal() {
  if (document.getElementById("comment-modal-overlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "comment-modal-overlay";
  overlay.className = "comment-modal-overlay";
  overlay.innerHTML = `
    <div class="comment-modal-box" onclick="event.stopPropagation()">
      <div class="comment-modal-header">
        <span id="comment-modal-title">Comment</span>
        <button type="button" class="comment-modal-close-btn" onclick="closeCommentModal()">✕</button>
      </div>
      <div id="comment-modal-body" class="comment-modal-body"></div>
    </div>
  `;
  overlay.addEventListener("click", closeCommentModal);
  document.body.appendChild(overlay);
}

function openCommentModal(btn, event) {
  event.stopPropagation();
  initCommentModal();
  const popover = btn.closest(".comment-popover");
  const bodyEl = popover.querySelector(".comment-popover-body");
  const headerSpan = popover.querySelector(".comment-popover-header span");

  const modalBody = document.getElementById("comment-modal-body");
  const modalTitle = document.getElementById("comment-modal-title");

  modalBody.innerHTML = bodyEl ? bodyEl.innerHTML : "";
  modalTitle.textContent = headerSpan ? headerSpan.textContent : "Comment";

  document.getElementById("comment-modal-overlay").classList.add("is-active");
  document.body.style.overflow = "hidden";
}

function closeCommentModal() {
  const overlay = document.getElementById("comment-modal-overlay");
  if (overlay) {
    overlay.classList.remove("is-active");
    document.body.style.overflow = "";
  }
}

window.openCommentModal = openCommentModal;
window.closeCommentModal = closeCommentModal;
window.clearFilter = clearFilter;
window.handleManualInput = handleManualInput;
window.toggleCommentExpand = toggleCommentExpand;
