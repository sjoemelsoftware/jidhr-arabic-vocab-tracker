const API_URL = "http://localhost:8000";

class ArabicLemmatizer {
  constructor() {
    this.tooltip = this.createTooltip();
    this.highlightedWords = new Map();
    this.setupEventListeners();
    this.processExistingParagraphs();
  }

  createTooltip() {
    const tooltip = document.createElement("div");
    tooltip.className = "arabic-lemmatizer-tooltip";
    document.body.appendChild(tooltip);
    return tooltip;
  }

  setupEventListeners() {
    this.setupParagraphListeners();
    this.setupTooltipListeners();
    this.setupGlobalClickHandler();
  }

  setupParagraphListeners() {
    document.addEventListener("mouseover", (e) => {
      const element = this.findArabicElement(e.target);
      if (
        element &&
        !element.classList.contains("arabic-lemmatizer-paragraph")
      ) {
        element.classList.add("arabic-lemmatizer-paragraph-hover");
      }
    });

    document.addEventListener("mouseout", (e) => {
      const element = this.findArabicElement(e.target);
      if (
        element &&
        !element.classList.contains("arabic-lemmatizer-paragraph")
      ) {
        element.classList.remove("arabic-lemmatizer-paragraph-hover");
      }
    });

    document.addEventListener("click", async (e) => {
      const element = this.findArabicElement(e.target);
      if (
        element &&
        !element.classList.contains("arabic-lemmatizer-paragraph")
      ) {
        await this.processParagraph(element);
      }
    });
  }

  setupTooltipListeners() {
    this.tooltip.addEventListener("mouseenter", () => {
      clearTimeout(this.tooltipTimeout);
    });

    this.tooltip.addEventListener("mouseleave", (e) => {
      const toElement = e.relatedTarget;
      if (
        toElement &&
        !toElement.classList.contains("arabic-lemmatizer-word")
      ) {
        this.tooltipTimeout = setTimeout(() => {
          if (!this.tooltip.matches(":hover")) {
            this.tooltip.style.display = "none";
          }
        }, 100);
      }
    });
  }

  setupGlobalClickHandler() {
    document.addEventListener("click", (e) => {
      if (
        !this.tooltip.contains(e.target) &&
        !e.target.classList.contains("arabic-lemmatizer-word")
      ) {
        this.tooltip.style.display = "none";
      }
    });
  }

  findArabicElement(element) {
    const textElements = [
      "P",
      "DIV",
      "SPAN",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "LI",
      "TD",
      "TH",
      "LABEL",
    ];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      if (
        textElements.includes(current.tagName) &&
        this.containsArabic(current.textContent)
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  containsArabic(text) {
    return /[\u0600-\u06FF]/.test(text);
  }

  async processParagraph(element) {
    const text = element.textContent;
    const result = await this.checkText(text);

    if (result?.words?.length > 0) {
      element.classList.add("arabic-lemmatizer-paragraph");
      element.classList.remove("arabic-lemmatizer-paragraph-hover");

      const fragment = document.createDocumentFragment();
      let currentText = text;

      result.words.forEach((word) => {
        const index = currentText.indexOf(word.word);
        if (index === -1) return;

        if (index > 0) {
          fragment.appendChild(
            document.createTextNode(currentText.slice(0, index))
          );
        }

        const span = this.createWordSpan(word);
        fragment.appendChild(span);
        this.highlightedWords.set(span, word);

        currentText = currentText.slice(index + word.word.length);
      });

      if (currentText) {
        fragment.appendChild(document.createTextNode(currentText));
      }

      element.innerHTML = "";
      element.appendChild(fragment);
    }
  }

  processExistingParagraphs() {
    const elements = document.querySelectorAll(
      "p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, label"
    );
    elements.forEach((element) => {
      if (this.containsArabic(element.textContent)) {
        element.classList.add("arabic-lemmatizer-paragraph-candidate");
      }
    });
  }

  createWordSpan(word) {
    const span = document.createElement("span");
    span.className = `arabic-lemmatizer-word ${
      word.is_known ? "known" : "unknown"
    }`;
    span.textContent = word.word;
    span.dataset.lemma = word.lemma;
    span.dataset.lemmaParts = JSON.stringify(word.lemma_parts);
    span.dataset.isKnown = word.is_known;

    this.addWordEventListeners(span, word);
    return span;
  }

  addWordEventListeners(span, word) {
    span.addEventListener("click", async (e) => {
      e.stopPropagation();
      const isCurrentlyKnown = span.dataset.isKnown === "true";
      const success = await this.updateWordStatus(
        word.word,
        isCurrentlyKnown ? [word.word] : []
      );

      if (success) {
        this.updateWordStatus(span, !isCurrentlyKnown);
      }
    });

    span.addEventListener("mouseenter", () => {
      clearTimeout(this.tooltipTimeout);
      this.showTooltip(span);
    });

    span.addEventListener("mouseleave", (e) => {
      const toElement = e.relatedTarget;
      if (toElement !== this.tooltip && !this.tooltip.contains(toElement)) {
        this.tooltipTimeout = setTimeout(() => {
          if (!this.tooltip.matches(":hover")) {
            this.tooltip.style.display = "none";
          }
        }, 100);
      }
    });
  }

  showTooltip(span) {
    const rect = span.getBoundingClientRect();
    const lemmaParts = JSON.parse(span.dataset.lemmaParts);

    this.tooltip.innerHTML = `
      <div class="lemma-parts">
        ${lemmaParts
          .map(
            (part) => `
          <div class="lemma-part" data-part="${part.part}" data-known="${
              part.is_known
            }">
            <span>${part.part}</span>
            <span class="status">${part.is_known ? "✓" : "✗"}</span>
          </div>
        `
          )
          .join("")}
      </div>
    `;

    this.addTooltipEventListeners();
    this.positionTooltip(rect);
  }

  addTooltipEventListeners() {
    this.tooltip.querySelectorAll(".lemma-part").forEach((partElement) => {
      partElement.addEventListener("click", async (e) => {
        e.stopPropagation();
        const part = partElement.dataset.part;
        const isCurrentlyKnown = partElement.dataset.known === "true";

        const success = await this.updateLemmaPart(part, !isCurrentlyKnown);
        if (success) {
          partElement.dataset.known = (!isCurrentlyKnown).toString();
          partElement.querySelector(".status").textContent = !isCurrentlyKnown
            ? "✓"
            : "✗";
        }
      });
    });
  }

  positionTooltip(rect) {
    const tooltipRect = this.tooltip.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 5;

    if (left + tooltipRect.width > window.innerWidth) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    if (top + tooltipRect.height > window.innerHeight) {
      top = rect.top - tooltipRect.height - 5;
    }

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.display = "block";
  }

  updateWordStatus(span, isKnown) {
    span.className = `arabic-lemmatizer-word ${
      isKnown ? "just-marked" : "unknown"
    }`;
    span.dataset.isKnown = isKnown;

    if (isKnown) {
      setTimeout(() => {
        span.classList.remove("just-marked");
      }, 2000);
    }
  }

  async checkText(text) {
    try {
      const response = await fetch(`${API_URL}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error("API request failed");
      return await response.json();
    } catch (error) {
      console.error("Error checking text:", error);
      return null;
    }
  }

  async updateWordStatus(text, unknownWords) {
    try {
      const response = await fetch(`${API_URL}/update-known`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, unknown_words: unknownWords }),
      });

      if (!response.ok) throw new Error("API request failed");
      return true;
    } catch (error) {
      console.error("Error updating word status:", error);
      return false;
    }
  }

  async updateLemmaPart(part, isKnown) {
    try {
      const response = await fetch(`${API_URL}/update-parts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parts: [{ part, is_known: isKnown }],
        }),
      });

      if (!response.ok) throw new Error("API request failed");

      const wordSpan = document.querySelector(
        `.arabic-lemmatizer-word[data-lemma-parts*="${part}"]`
      );
      if (wordSpan) {
        const lemmaParts = JSON.parse(wordSpan.dataset.lemmaParts);
        const updatedParts = lemmaParts.map((p) =>
          p.part === part ? { ...p, is_known } : p
        );
        wordSpan.dataset.lemmaParts = JSON.stringify(updatedParts);

        const allKnown = updatedParts.every((p) => p.is_known);
        wordSpan.className = `arabic-lemmatizer-word ${
          allKnown ? "known" : "unknown"
        }`;
        wordSpan.dataset.isKnown = allKnown;
      }

      return true;
    } catch (error) {
      console.error("Error updating lemma part:", error);
      return false;
    }
  }
}

// Initialize the extension
new ArabicLemmatizer();
