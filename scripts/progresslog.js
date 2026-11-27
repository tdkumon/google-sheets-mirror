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

  const tableClickContainer = document.getElementById("table-container");
  if (tableClickContainer) {
    tableClickContainer.addEventListener("click", (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const titleLink = e.target.closest(".title-clickable");
      if (!titleLink) return;

      const row = titleLink.closest("tr");
      if (!row) return;
      const entryId = row.getAttribute("data-id");
      if (!entryId) return;

      e.preventDefault();
      returnToViewAllOnClear = false;
      const baseId = entryId.split("-")[0];
      selectEntryById(baseId, titleLink.textContent.trim(), false);
    });
  }

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

  Papa.parse("../csv/progresslog.csv", {
    download: true,
    skipEmptyLines: true,
    complete: function (results) {
      renderProgressLog(results.data);

      const urlParams = new URLSearchParams(window.location.search);
      const targetId = urlParams.get("id");
      if (targetId) {
        const targetBaseId = targetId.split("-")[0];
        const safeId = CSS.escape(targetBaseId);
        const row = document.querySelector(
          `tr[data-id="${safeId}"], tr[data-id^="${safeId}-"]`,
        );
        const titleSpan = row ? row.querySelector(".title-clickable") : null;
        selectEntryById(
          targetBaseId,
          titleSpan ? titleSpan.textContent.trim() : "",
        );
      }
    },
    error: function () {
      document.getElementById("table-container").innerHTML =
        '<div class="no-results">Failed to load progress log CSV data.</div>';
    },
  });

  const headerImg = document.querySelector(".header-img");
  if (headerImg) {
    headerImg.addEventListener("click", () => {
      document.body.classList.toggle("show-ids");
    });
  }

  const searchContainer = document.querySelector(".search-container");
  let alphaContainer = document.getElementById("alphabetical-list-container");
  if (!alphaContainer && searchContainer) {
    alphaContainer = document.createElement("div");
    alphaContainer.id = "alphabetical-list-container";
    alphaContainer.className = "alphabetical-list-container";
    searchContainer.after(alphaContainer);
  }

  const viewAllBtn = document.getElementById("view-all-btn");
  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", () => toggleViewAll(true, true));
  }

  window.addEventListener("popstate", syncStateFromLocation);
});

function selectEntryById(baseId, fallbackTitleText = "", fromViewAll = false) {
  if (!baseId) return;

  const searchInput = document.getElementById("search-input");
  if (searchInput && !searchInput.getAttribute("data-filtered-id")) {
    savedSearchQuery = searchInput.value;
  }

  const cleanBaseId = String(baseId).split("-")[0];

  const meta = window.progressLogMetadata[cleanBaseId];
  if (!meta && fallbackTitleText) {
    window.progressLogMetadata[cleanBaseId] = {
      cleanTitle: cleanTitle(fallbackTitleText),
      sessions: 1,
      firstDate: "Unknown",
      lastDate: "Unknown",
      status: "In Progress",
      revisits: 0,
    };
  }

  if (window.history && window.history.pushState) {
    const newUrl = `${window.location.pathname}?id=${encodeURIComponent(cleanBaseId)}`;
    window.history.pushState(
      { id: cleanBaseId, fromViewAll: Boolean(fromViewAll) },
      "",
      newUrl,
    );
  }

  syncStateFromLocation();
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

function parseEntryDate(dayStr, monthTitleStr) {
  const monthNames = {
    january: 0,
    jan: 0,
    february: 1,
    feb: 1,
    march: 2,
    mar: 2,
    april: 3,
    apr: 3,
    may: 4,
    june: 5,
    jun: 5,
    july: 6,
    jul: 6,
    august: 7,
    aug: 7,
    september: 8,
    sep: 8,
    sept: 8,
    october: 9,
    oct: 9,
    november: 10,
    nov: 10,
    december: 11,
    dec: 11,
  };

  const dayMatch = (dayStr || "").trim().match(/\d{1,2}/);
  const monthMatch = (monthTitleStr || "")
    .trim()
    .match(/^([A-Za-z]+)\s+(\d{4})$/);

  if (!dayMatch || !monthMatch) return null;

  const day = parseInt(dayMatch[0], 10);
  const monthIndex = monthNames[monthMatch[1].toLowerCase()];
  const year = parseInt(monthMatch[2], 10);

  if (monthIndex === undefined || isNaN(day) || isNaN(year)) return null;

  const dateObj = new Date(year, monthIndex, day);
  if (
    isNaN(dateObj.getTime()) ||
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== monthIndex ||
    dateObj.getDate() !== day
  ) {
    return null;
  }

  return dateObj;
}

function cleanTitle(fullTitle) {
  const actionWord =
    "(?:finished|played|read|watched|started|dropped|restarted)";
  const actionPrefixRegex = new RegExp(
    `^.*?\\b${actionWord}(?:\\s*(?:&|and)\\s*${actionWord})*\\b\\s*`,
    "i",
  );

  let cleaned = fullTitle.replace(actionPrefixRegex, "").trim();

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
  const shouldReturnToViewAll = returnToViewAllOnClear;
  returnToViewAllOnClear = false;

  if (window.history && window.history.replaceState) {
    window.history.replaceState(
      { viewAll: Boolean(shouldReturnToViewAll) },
      document.title,
      window.location.pathname,
    );
  }

  if (shouldReturnToViewAll) {
    returnToViewAllOnClear = true;
  }

  syncStateFromLocation();

  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
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
  let idEntriesMap = {};

  rows.forEach((row) => {
    const colId = (row[0] || "").trim();
    const col1 = (row[1] || "").trim();
    const col2 = (row[2] || "").trim();
    const col3 = (row[3] || "").trim();
    const col4 = (row[4] || "").trim();
    const col5 = (row[5] || "").trim();
    const col6 = (row[6] || "").trim();

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
        const parts = colId.split("-");
        const baseId = parts[0];
        const revisitNum = parts.length > 1 ? parseInt(parts[1], 10) : 1;
        const dateObj = parseEntryDate(currentDayBlock.date, currentMonthTitle);

        if (!idEntriesMap[baseId]) {
          idEntriesMap[baseId] = {
            titles: [],
            dates: [],
            entriesCount: 0,
            maxRevisit: 1,
            overrideTitle: "",
          };
        }
        idEntriesMap[baseId].entriesCount += 1;
        idEntriesMap[baseId].titles.push(col2);

        if (col6 && !idEntriesMap[baseId].overrideTitle) {
          idEntriesMap[baseId].overrideTitle = col6;
        }

        if (revisitNum > idEntriesMap[baseId].maxRevisit) {
          idEntriesMap[baseId].maxRevisit = revisitNum;
        }
        if (dateObj) {
          idEntriesMap[baseId].dates.push({
            dateStr: entryDateStr,
            dateObj: dateObj,
          });
        }
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

  Object.keys(idEntriesMap).forEach((baseId) => {
    const data = idEntriesMap[baseId];
    data.dates.sort((a, b) => a.dateObj - b.dateObj);

    const firstDate = data.dates.length > 0 ? data.dates[0].dateStr : "Unknown";
    const lastDate =
      data.dates.length > 0
        ? data.dates[data.dates.length - 1].dateStr
        : "Unknown";
    const lastDateObj =
      data.dates.length > 0 ? data.dates[data.dates.length - 1].dateObj : null;
    const cleanTitleText = data.overrideTitle
      ? data.overrideTitle
      : data.titles.length > 0
        ? cleanTitle(data.titles[0])
        : baseId;

    let status = "In Progress";
    let hasFinished = false;
    let hasDropped = false;

    data.titles.forEach((title) => {
      const lower = title.toLowerCase();
      if (/\b(finished|played|read|watched)\b/.test(lower)) hasFinished = true;
      if (/\b(dropped)\b/.test(lower)) hasDropped = true;
    });

    if (hasFinished) {
      status = "Completed";
    } else if (hasDropped) {
      status = "Dropped";
    } else if (lastDateObj) {
      const diffDays = (new Date() - lastDateObj) / (1000 * 60 * 60 * 24);
      if (diffDays > 30) {
        status = "Paused";
      } else {
        status = "In Progress";
      }
    }

    const revisits = data.maxRevisit > 1 ? data.maxRevisit - 1 : 0;

    window.progressLogMetadata[baseId] = {
      cleanTitle: cleanTitleText,
      sessions: data.entriesCount,
      firstDate: firstDate,
      lastDate: lastDate,
      status: status,
      revisits: revisits,
    };
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
              <div class="comment-popover-body">if there are two values in two separate lines without an "&" (like episode 1 in one line, then episode 2 in the next), it means i slept in between<br><br>(for example, i watched episode 1 at 2 AM, went to sleep, then watched episode 2 sometime after i woke up, but still on the same date)</div>
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

        let idBadgeHtml = entry.id
          ? `<span class="entry-id-badge">ID ${escapeHTML(entry.id)}</span>`
          : "";

        const entryBaseId = entry.id ? entry.id.split("-")[0] : "";
        const thumbHtml = entryBaseId
          ? `<img class="entry-title-thumb" src="../thumbs/${escapeHTML(entryBaseId)}.png" alt="" loading="lazy" onerror="this.onerror=null;this.src='../thumbs/yuno.png'">`
          : "";

        html += `
  <td class="col-title"><div class="title-cell-inner">${thumbHtml}${formatTitle(entry.title, entryBaseId)}</div>${idBadgeHtml}</td>
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
  updateFirstVisibleTable();
}

function renderNoteCell(note, comment) {
  const escapedNote = escapeHTML(note);
  if (!comment) return escapedNote;

  const escapedComment = escapeHTML(comment);
  const isLong = comment.length > 350 || comment.split("\n").length > 3;

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

  if (isViewAllActive) {
    filterAlphabeticalList(query);
    return;
  }

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
          const rowBaseId = rowId ? rowId.split("-")[0] : "";
          const titleCell = row.querySelector(".col-title");
          const titleText = titleCell
            ? titleCell.textContent.toLowerCase()
            : "";

          let isMatch = false;

          if (activeIdFilter) {
            isMatch = rowBaseId === activeIdFilter;
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
  updateFirstVisibleTable();
}

function formatTitle(title, baseId = "") {
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
  const href = baseId ? ` href="${escapeHTML(getEntryUrl(baseId))}"` : "";
  return `<a class="title-clickable"${href}>${content}</a>`;
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

let isViewAllActive = false;
let returnToViewAllOnClear = false;
let savedSearchQuery = "";

function toggleViewAll(pushHistory = true, resetSavedQuery = pushHistory) {
  const nextActive = !isViewAllActive;
  isViewAllActive = nextActive;

  const viewAllBtn = document.getElementById("view-all-btn");
  const tableContainer = document.getElementById("table-container");
  const alphaContainer = document.getElementById("alphabetical-list-container");
  const searchInput = document.getElementById("search-input");
  const searchWrapper = document.getElementById("search-wrapper");
  const filterBanner = document.getElementById("filter-banner");

  if (searchInput) {
    if (resetSavedQuery) {
      savedSearchQuery = "";
      searchInput.value = "";
    } else {
      searchInput.value = savedSearchQuery;
    }
    searchInput.removeAttribute("data-filtered-id");
    searchInput.style.removeProperty("width");
    updateSearchClearVisibility();
  }

  if (searchWrapper) searchWrapper.style.display = "flex";
  if (filterBanner) filterBanner.style.display = "none";

  if (viewAllBtn) {
    viewAllBtn.textContent = isViewAllActive ? "back" : "index";
  }

  if (isViewAllActive) {
    if (pushHistory && window.history && window.history.pushState) {
      window.history.pushState({ viewAll: true }, "", window.location.pathname);
    }
    renderAlphabeticalList();
    if (tableContainer) tableContainer.style.display = "none";
    if (alphaContainer) alphaContainer.classList.add("is-active");

    const queryToUse = resetSavedQuery ? "" : savedSearchQuery;
    filterAlphabeticalList(queryToUse);
  } else {
    if (tableContainer) tableContainer.style.display = "";
    if (alphaContainer) {
      alphaContainer.classList.remove("is-active");
      alphaContainer.innerHTML = "";
    }
    handleSearch();
  }
}

function filterAlphabeticalList(query) {
  const alphaContainer = document.getElementById("alphabetical-list-container");
  if (!alphaContainer) return;

  const normalizedQuery = (query || "").toLowerCase().trim();
  const items = alphaContainer.querySelectorAll(".alpha-list-item");
  let matchCount = 0;

  items.forEach((item) => {
    const text = item.textContent.toLowerCase();
    const isMatch = normalizedQuery === "" || text.includes(normalizedQuery);
    item.style.display = isMatch ? "" : "none";
    if (isMatch) matchCount++;
  });

  let emptyEl = alphaContainer.querySelector(".no-results");
  if (matchCount === 0 && normalizedQuery !== "") {
    if (!emptyEl) {
      emptyEl = document.createElement("div");
      emptyEl.className = "no-results";
      alphaContainer.appendChild(emptyEl);
    }
    //emptyEl.textContent = `No titles matching "${query.trim()}".`;
    emptyEl.style.display = "";
  } else if (emptyEl) {
    emptyEl.style.display = "none";
  }
}

function renderAlphabeticalList() {
  const alphaContainer = document.getElementById("alphabetical-list-container");
  if (!alphaContainer) return;

  alphaContainer.innerHTML = "";

  const entries = Object.keys(window.progressLogMetadata).map((baseId) => ({
    baseId: baseId,
    cleanTitle: window.progressLogMetadata[baseId].cleanTitle,
  }));

  entries.sort((a, b) => {
    const aIsBottom = a.baseId === "106";
    const bIsBottom = b.baseId === "106";

    if (aIsBottom && !bIsBottom) return 1;
    if (!aIsBottom && bIsBottom) return -1;

    return a.cleanTitle.localeCompare(b.cleanTitle, undefined, {
      sensitivity: "base",
    });
  });

  entries.forEach((item) => {
    const el = document.createElement("a");
    el.className = "alpha-list-item";
    el.href = getEntryUrl(item.baseId);
    el.textContent = item.cleanTitle;

    el.addEventListener("click", (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      e.preventDefault();
      const searchInput = document.getElementById("search-input");
      if (searchInput) {
        savedSearchQuery = searchInput.value;
      }
      returnToViewAllOnClear = true;
      toggleViewAll(true, false);
      selectEntryById(item.baseId, item.cleanTitle, true);
    });

    alphaContainer.appendChild(el);
  });
}

function getEntryUrl(baseId) {
  return `${window.location.pathname}?id=${encodeURIComponent(baseId)}`;
}

function syncStateFromLocation(event = null) {
  const urlParams = new URLSearchParams(window.location.search);
  const rawId = (urlParams.get("id") || "").trim();
  const baseId = rawId ? rawId.split("-")[0] : "";

  const searchInput = document.getElementById("search-input");
  const searchClearBtn = document.getElementById("search-clear-btn");
  const searchWrapper = document.getElementById("search-wrapper");
  const filterBanner = document.getElementById("filter-banner");
  const tableContainer = document.getElementById("table-container");
  const alphaContainer = document.getElementById("alphabetical-list-container");
  const viewAllBtn = document.getElementById("view-all-btn");

  if (!baseId) {
    document.title = "tdk's progress log";
    if (searchInput) {
      searchInput.value = savedSearchQuery;
      searchInput.removeAttribute("data-filtered-id");
      searchInput.style.removeProperty("width");
    }
    if (searchClearBtn) {
      searchClearBtn.classList.toggle(
        "is-visible",
        savedSearchQuery.length > 0,
      );
    }
    if (searchWrapper) searchWrapper.style.display = "flex";
    if (filterBanner) filterBanner.style.display = "none";

    const shouldRestoreViewAll =
      returnToViewAllOnClear ||
      Boolean(
        event &&
        event.state &&
        (event.state.fromViewAll || event.state.viewAll),
      );
    returnToViewAllOnClear = false;

    if (shouldRestoreViewAll) {
      if (!isViewAllActive) {
        toggleViewAll(false, false);
      } else {
        renderAlphabeticalList();
        if (tableContainer) tableContainer.style.display = "none";
        if (alphaContainer) alphaContainer.classList.add("is-active");
      }
      if (searchInput) {
        searchInput.value = savedSearchQuery;
      }
      if (searchClearBtn) {
        searchClearBtn.classList.toggle(
          "is-visible",
          savedSearchQuery.length > 0,
        );
      }
      filterAlphabeticalList(savedSearchQuery);
    } else {
      isViewAllActive = false;
      if (viewAllBtn) viewAllBtn.textContent = "index";
      if (tableContainer) tableContainer.style.display = "";
      if (alphaContainer) {
        alphaContainer.classList.remove("is-active");
        alphaContainer.innerHTML = "";
      }
      handleSearch();
    }
    return;
  }

  if (event && event.state && event.state.fromViewAll) {
    returnToViewAllOnClear = true;
  }

  if (isViewAllActive) {
    isViewAllActive = false;
    if (viewAllBtn) viewAllBtn.textContent = "index";
    if (alphaContainer) {
      alphaContainer.classList.remove("is-active");
      alphaContainer.innerHTML = "";
    }
  }
  if (tableContainer) tableContainer.style.display = "";

  const safeId = CSS.escape(baseId);
  const row = document.querySelector(
    `tr[data-id="${safeId}"], tr[data-id^="${safeId}-"]`,
  );
  const titleSpan = row ? row.querySelector(".title-clickable") : null;
  const fallbackTitleText = titleSpan ? titleSpan.textContent.trim() : "";

  const meta = window.progressLogMetadata[baseId] || {
    cleanTitle: fallbackTitleText ? cleanTitle(fallbackTitleText) : baseId,
    sessions: 1,
    firstDate: "Unknown",
    lastDate: "Unknown",
    status: "In Progress",
    revisits: 0,
  };

  document.title = `tdk's logs for ${meta.cleanTitle}`;

  if (searchInput) {
    searchInput.setAttribute("data-filtered-id", baseId);
  }

  const bannerText = document.getElementById("filter-banner-text");
  if (bannerText) {
    const revisitHtml =
      meta.revisits > 0
        ? `<span class="entry-revisit-info" title="Revisited ${meta.revisits} time(s)">↻ ${meta.revisits}</span>`
        : "";

    bannerText.innerHTML = `
      <div class="entry-card">
        <img class="entry-card-thumb" src="../thumbs/${escapeHTML(baseId)}.png" alt="" onerror="this.onerror=null;this.src='../thumbs/yuno.png'">
        <div class="entry-card-info">
          <div class="entry-card-title">${escapeHTML(meta.cleanTitle)} ${revisitHtml}</div>
          <div class="entry-card-status-row">
            <strong>Status:</strong> <span class="entry-status-badge status-${meta.status.toLowerCase().replace(/\s+/g, "-")}">${escapeHTML(meta.status)}</span>
          </div>
          <div class="entry-card-metrics-row">
            <div class="entry-metric-item">
              <span class="entry-metric-label">Days Logged</span>
              <span class="entry-metric-value">${meta.sessions}</span>
            </div>
            <div class="entry-metric-item">
              <span class="entry-metric-label">First Logged</span>
              <span class="entry-metric-value">${escapeHTML(meta.firstDate)}</span>
            </div>
            <div class="entry-metric-item">
              <span class="entry-metric-label">Last Logged</span>
              <span class="entry-metric-value">${escapeHTML(meta.lastDate)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (searchWrapper) searchWrapper.style.display = "none";
  if (filterBanner) filterBanner.style.display = "flex";

  handleSearch();
}

const searchInput = document.getElementById("search-input");
const searchClearBtn = document.getElementById("search-clear-btn");
const clearBtn = document.getElementById("clear-filter-btn");

if (clearBtn) {
  clearBtn.addEventListener("click", clearFilter);
}

function updateSearchClearVisibility() {
  if (!searchInput || !searchClearBtn) return;
  searchClearBtn.classList.toggle("is-visible", searchInput.value.length > 0);
}

if (searchInput) {
  searchInput.value = "";
  updateSearchClearVisibility();
  searchInput.addEventListener("input", () => {
    if (!searchInput.getAttribute("data-filtered-id")) {
      savedSearchQuery = searchInput.value;
    }
    updateSearchClearVisibility();
    if (isViewAllActive) {
      filterAlphabeticalList(searchInput.value);
    } else {
      handleManualInput();
    }
  });
}

if (searchClearBtn && searchInput) {
  searchClearBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });

  searchClearBtn.addEventListener("click", () => {
    savedSearchQuery = "";
    searchInput.value = "";
    updateSearchClearVisibility();
    if (isViewAllActive) {
      filterAlphabeticalList("");
    } else {
      handleManualInput();
    }
    searchInput.blur();
    searchClearBtn.blur();
  });
}

function updateFirstVisibleTable() {
  const tables = document.querySelectorAll("#table-container table");
  let firstFound = false;
  tables.forEach((table) => {
    if (table.style.display !== "none") {
      if (!firstFound) {
        table.classList.add("is-first-visible-table");
        firstFound = true;
      } else {
        table.classList.remove("is-first-visible-table");
      }
    } else {
      table.classList.remove("is-first-visible-table");
    }
  });
}

window.openCommentModal = openCommentModal;
window.closeCommentModal = closeCommentModal;
window.clearFilter = clearFilter;
window.handleManualInput = handleManualInput;
window.toggleCommentExpand = toggleCommentExpand;
