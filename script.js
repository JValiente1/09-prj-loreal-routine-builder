/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearchInput = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectionsBtn = document.getElementById("clearSelections");
const generateRoutineBtn = document.getElementById("generateRoutine");
const generateRoutineStickyBtn = document.getElementById(
  "generateRoutineSticky",
);
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const workerUrl = "https://shy-shape-77b2.jackie-valiente1.workers.dev";
const openAiApiKey =
  typeof OPENAI_API_KEY !== "undefined" ? OPENAI_API_KEY : "";

/* Store all products and selected IDs so we can keep selections across categories */
let allProducts = [];
const selectedProductIds = new Set();
let generatedRoutineText = "";
let currentCategory = "";
let currentSearchTerm = "";
const selectedProductsStorageKey = "lorealSelectedProductIds";

const followUpSystemPrompt =
  "You are a beauty routine advisor. Answer follow-up questions only about the generated routine or related beauty topics: skincare, haircare, makeup, fragrance, skin concerns, hair concerns, and product usage. If a question is unrelated, politely refuse and guide the user back to routine/beauty topics. Keep answers clear and beginner-friendly.";

let conversationMessages = [{ role: "system", content: followUpSystemPrompt }];

/* Store the user's name once they introduce themselves */
let userName = "";

function setGenerateButtonsState(isLoading) {
  const buttons = [generateRoutineBtn, generateRoutineStickyBtn].filter(
    Boolean,
  );

  buttons.forEach((button) => {
    button.disabled = isLoading;
    button.innerHTML = isLoading
      ? '<i class="fa-solid fa-spinner fa-spin"></i> Generating...'
      : '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine';
  });
}

/* Save selected product IDs in localStorage */
function saveSelectedProductsToStorage() {
  localStorage.setItem(
    selectedProductsStorageKey,
    JSON.stringify(Array.from(selectedProductIds)),
  );
}

/* Restore selected product IDs from localStorage */
function loadSelectedProductsFromStorage() {
  const savedValue = localStorage.getItem(selectedProductsStorageKey);

  if (!savedValue) {
    return;
  }

  try {
    const parsedIds = JSON.parse(savedValue);

    if (!Array.isArray(parsedIds)) {
      return;
    }

    parsedIds.forEach((id) => {
      const numericId = Number(id);
      const productExists = allProducts.some(
        (product) => product.id === numericId,
      );

      if (productExists) {
        selectedProductIds.add(numericId);
      }
    });
  } catch {
    localStorage.removeItem(selectedProductsStorageKey);
  }
}

function updateSelectionButtonsState() {
  const hasSelections = selectedProductIds.size > 0;
  clearSelectionsBtn.disabled = !hasSelections;
}

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products match your search and category filters.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div
      class="product-card ${selectedProductIds.has(product.id) ? "is-selected" : ""}"
      data-product-id="${product.id}"
      role="button"
      tabindex="0"
      aria-pressed="${selectedProductIds.has(product.id)}"
      aria-label="${selectedProductIds.has(product.id) ? "Unselect" : "Select"} ${product.name}"
    >
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p class="product-brand">${product.brand}</p>
        <button
          type="button"
          class="description-toggle"
          aria-expanded="false"
          aria-controls="product-description-${product.id}"
        >
          View details
        </button>
        <p class="product-description" id="product-description-${product.id}" hidden>
          ${product.description}
        </p>
      </div>
    </div>
  `,
    )
    .join("");
}

function applyProductFilters() {
  const filteredProducts = allProducts.filter((product) => {
    const matchesCategory =
      !currentCategory || product.category === currentCategory;

    const searchableText =
      `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();
    const matchesSearch =
      !currentSearchTerm || searchableText.includes(currentSearchTerm);

    return matchesCategory && matchesSearch;
  });

  displayProducts(filteredProducts);
}

/* Render selected products under the "Selected Products" section */
function renderSelectedProducts() {
  if (selectedProductIds.size === 0) {
    selectedProductsList.innerHTML = `
      <p class="selected-placeholder">No products selected yet.</p>
    `;
    updateSelectionButtonsState();
    return;
  }

  const selectedProductsHtml = Array.from(selectedProductIds)
    .map((id) => allProducts.find((product) => product.id === id))
    .filter(Boolean)
    .map(
      (product) => `
      <div class="selected-chip" data-product-id="${product.id}">
        <span>${product.name}</span>
        <button type="button" class="remove-selected-btn" aria-label="Remove ${product.name}">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `,
    )
    .join("");

  selectedProductsList.innerHTML = selectedProductsHtml;
  updateSelectionButtonsState();
}

/* Toggle product selection in both the grid and selected list */
function toggleProductSelection(productId) {
  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId);
  } else {
    selectedProductIds.add(productId);
  }

  saveSelectedProductsToStorage();
  renderSelectedProducts();
}

/* Build a clean JSON array for only the selected products */
function getSelectedProductsData() {
  return Array.from(selectedProductIds)
    .map((id) => allProducts.find((product) => product.id === id))
    .filter(Boolean)
    .map((product) => ({
      name: product.name,
      brand: product.brand,
      category: product.category,
      description: product.description,
    }));
}

/* Keep AI output safe when inserting into HTML */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatForChat(text) {
  return escapeHtml(text).replace(/\n/g, "<br>");
}

function renderCitations(citations) {
  if (!citations || citations.length === 0) {
    return "";
  }

  const citationLinks = citations
    .map((citation, index) => {
      const safeUrl = escapeHtml(citation.url || "");
      const safeTitle = escapeHtml(citation.title || `Source ${index + 1}`);
      return `<li><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeTitle}</a></li>`;
    })
    .join("");

  return `
    <div class="chat-citations">
      <strong>Sources</strong>
      <ul>${citationLinks}</ul>
    </div>
  `;
}

/* Append one message to the chat window */
function appendChatMessage(sender, text, citations = []) {
  const senderLabel = sender === "user" ? "You" : "Advisor";
  const bubbleClass =
    sender === "user" ? "chat-message user-message" : "chat-message ai-message";

  chatWindow.innerHTML += `
    <div class="${bubbleClass}" dir="ltr">
      <strong>${senderLabel}:</strong><br>
      ${formatForChat(text)}
      ${renderCitations(citations)}
    </div>
  `;

  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Send messages to Cloudflare Worker, or fall back to OpenAI directly */
async function callAdvisorWithWorker(messages, useWebSearch = false) {
  /* --- Cloudflare Worker path --- */
  if (workerUrl) {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, webSearch: useWebSearch }),
    });

    if (!response.ok) {
      throw new Error(`Worker request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0]?.message?.content) {
      throw new Error("No response text was returned by the worker.");
    }

    return {
      text: data.choices[0].message.content,
      citations: Array.isArray(data.citations) ? data.citations : [],
    };
  }

  /* --- Direct OpenAI fallback (no web search) --- */
  if (!openAiApiKey) {
    throw new Error("No worker URL and no OpenAI API key available.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`);
  }

  const data = await response.json();

  return {
    text: data.choices[0].message.content,
    citations: [],
  };
}

/* Call OpenAI using only selected products and show routine in chat window */
async function generateRoutineFromSelectedProducts() {
  const selectedProductsData = getSelectedProductsData();

  if (selectedProductsData.length === 0) {
    chatWindow.innerHTML =
      "Please select at least one product before generating a routine.";
    return;
  }

  generateRoutineBtn.disabled = true;
  setGenerateButtonsState(true);

  /* Show a personalized loading message without wiping the conversation */
  const loadingId = "routine-loading-" + Date.now();
  chatWindow.innerHTML += `<div class="chat-message ai-message" dir="ltr" id="${loadingId}"><em>Because you are worth it, ${userName || "you"}... ✨</em></div>`;
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const routineRequestMessages = [
      {
        role: "system",
        content:
          "You are a beauty routine advisor. Create a clear morning and evening routine using the selected products. Include current product/routine insights if relevant and cite web sources when you use them. Keep the answer beginner-friendly.",
      },
      {
        role: "user",
        content: `Use only this selected product JSON when creating the routine:\n${JSON.stringify(selectedProductsData, null, 2)}`,
      },
    ];

    const routineResponse = await callAdvisorWithWorker(
      routineRequestMessages,
      true,
    );

    const routineText = routineResponse.text;

    generatedRoutineText = routineText;

    /* Reset follow-up memory for a new routine and keep the routine in context */
    conversationMessages = [
      { role: "system", content: followUpSystemPrompt },
      {
        role: "system",
        content: `Generated routine context:\n${generatedRoutineText}`,
      },
      {
        role: "assistant",
        content: `Generated routine:\n${generatedRoutineText}`,
      },
    ];

    /* Remove loading message and show the routine */
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();

    appendChatMessage(
      "assistant",
      `Here is your personalized routine, ${userName}!\n\n${routineText}`,
      routineResponse.citations,
    );
  } catch (error) {
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();
    appendChatMessage(
      "assistant",
      `Could not generate routine. ${error.message}`,
    );
  } finally {
    setGenerateButtonsState(false);
  }
}

/* Send follow-up question with full conversation history */
async function sendFollowUpQuestion(questionText) {
  if (!generatedRoutineText) {
    appendChatMessage(
      "assistant",
      "Generate a routine first, then ask follow-up questions about your routine or beauty topics.",
    );
    return;
  }

  appendChatMessage("user", questionText);

  sendBtn.disabled = true;
  /* Show personalized loading message */
  const loadingId = "loading-msg-" + Date.now();
  chatWindow.innerHTML += `<div class="chat-message ai-message" dir="ltr" id="${loadingId}"><em>Because you are worth it, ${userName || "you"}...</em></div>`;
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const requestMessages = [
      ...conversationMessages,
      { role: "user", content: questionText },
    ];

    const followUpResponse = await callAdvisorWithWorker(requestMessages, true);
    const answer = followUpResponse.text;

    conversationMessages.push({ role: "user", content: questionText });
    conversationMessages.push({ role: "assistant", content: answer });

    /* Remove the loading message then show the real answer */
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();

    appendChatMessage("assistant", answer, followUpResponse.citations);
  } catch (error) {
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();
    appendChatMessage("assistant", `Could not get a reply. ${error.message}`);
  } finally {
    sendBtn.disabled = false;
  }
}

/* Show the welcome greeting in the chat window asking for the user's name */
function showWelcomeGreeting() {
  chatWindow.innerHTML = `
    <div class="chat-message ai-message" dir="ltr">
      <strong>Advisor:</strong><br>
      Hello! Welcome to the L&#39;Or&eacute;al Routine Builder. &#x2728;<br><br>
      I&#39;m your personal beauty advisor. Before we get started, what&#39;s your name?
    </div>
  `;
}

/* Initialize app data once and show selected-products placeholder */
async function initializeApp() {
  allProducts = await loadProducts();
  loadSelectedProductsFromStorage();
  renderSelectedProducts();
  applyProductFilters();
  showWelcomeGreeting();
}

initializeApp();

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", (e) => {
  currentCategory = e.target.value;
  applyProductFilters();
});

productSearchInput.addEventListener("input", (e) => {
  currentSearchTerm = e.target.value.trim().toLowerCase();
  applyProductFilters();
});

/* Click a product card to select/unselect it */
productsContainer.addEventListener("click", (e) => {
  const descriptionButton = e.target.closest(".description-toggle");

  if (descriptionButton) {
    const parentCard = descriptionButton.closest(".product-card");
    const descriptionElement = parentCard.querySelector(".product-description");
    const isExpanded =
      descriptionButton.getAttribute("aria-expanded") === "true";

    descriptionButton.setAttribute("aria-expanded", String(!isExpanded));
    descriptionButton.textContent = isExpanded
      ? "View details"
      : "Hide details";
    descriptionElement.hidden = isExpanded;
    parentCard.classList.toggle("show-description", !isExpanded);
    return;
  }

  const clickedCard = e.target.closest(".product-card");

  if (!clickedCard) {
    return;
  }

  const productId = Number(clickedCard.dataset.productId);
  toggleProductSelection(productId);

  const isNowSelected = selectedProductIds.has(productId);
  clickedCard.classList.toggle("is-selected", isNowSelected);
  clickedCard.setAttribute("aria-pressed", String(isNowSelected));

  const product = allProducts.find((item) => item.id === productId);
  if (product) {
    clickedCard.setAttribute(
      "aria-label",
      `${isNowSelected ? "Unselect" : "Select"} ${product.name}`,
    );
  }
});

/* Press Enter or Space on a focused card to toggle product selection */
productsContainer.addEventListener("keydown", (e) => {
  if (e.target.closest("button")) {
    return;
  }

  const focusedCard = e.target.closest(".product-card");

  if (!focusedCard) {
    return;
  }

  if (e.key !== "Enter" && e.key !== " ") {
    return;
  }

  e.preventDefault();
  focusedCard.click();
});

/* Allow removing products directly from the selected list */
selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest(".remove-selected-btn");

  if (!removeButton) {
    return;
  }

  const selectedChip = removeButton.closest(".selected-chip");
  const productId = Number(selectedChip.dataset.productId);

  selectedProductIds.delete(productId);
  saveSelectedProductsToStorage();
  renderSelectedProducts();

  /* Keep the card state in sync if the product is currently visible */
  const visibleCard = productsContainer.querySelector(
    `.product-card[data-product-id="${productId}"]`,
  );

  if (visibleCard) {
    visibleCard.classList.remove("is-selected");
    visibleCard.setAttribute("aria-pressed", "false");

    const product = allProducts.find((item) => item.id === productId);
    if (product) {
      visibleCard.setAttribute("aria-label", `Select ${product.name}`);
    }
  }
});

/* Clear all selected products at once and update saved local data */
clearSelectionsBtn.addEventListener("click", () => {
  selectedProductIds.clear();
  saveSelectedProductsToStorage();
  renderSelectedProducts();

  const visibleCards = productsContainer.querySelectorAll(".product-card");
  visibleCards.forEach((card) => {
    const productId = Number(card.dataset.productId);
    const product = allProducts.find((item) => item.id === productId);

    card.classList.remove("is-selected");
    card.setAttribute("aria-pressed", "false");

    if (product) {
      card.setAttribute("aria-label", `Select ${product.name}`);
    }
  });
});

/* Generate a routine from selected products */
generateRoutineBtn.addEventListener("click", async () => {
  await generateRoutineFromSelectedProducts();
});

if (generateRoutineStickyBtn) {
  generateRoutineStickyBtn.addEventListener("click", async () => {
    await generateRoutineFromSelectedProducts();
  });
}

/* Chat form submission handler */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const questionText = userInput.value.trim();

  if (!questionText) {
    return;
  }

  userInput.value = "";

  /* If we don't have the user's name yet, treat first message as the name */
  if (!userName) {
    userName = questionText;
    appendChatMessage("user", questionText);
    /* Update the input placeholder to include the user's name */
    userInput.placeholder = `Because you are worth it, ${userName} — ask me about products or routines…`;
    appendChatMessage(
      "assistant",
      `Nice to meet you, ${userName}! 🌟\n\nSelect a category and choose the products you'd like to use, then hit "Generate Routine" and I'll create a personalized beauty routine just for you.`,
    );
    return;
  }

  await sendFollowUpQuestion(questionText);
});
