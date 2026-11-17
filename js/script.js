
/* ========================================
   CONFIGURAÇÃO DA LOJA
======================================== */

const SUPABASE_URL = "https://msjabqerfsyxiuawxflf.supabase.co";
const SUPABASE_KEY = "sb_publishable_7xs523Y1rdpWb1CF7WVEEw_V5np1ogw";

const PLACEHOLDER_IMAGE =
    "https://placehold.co/600x600/121217/ef4444?text=Produto";


/* ========================================
   ESTADOS DA LOJA
======================================== */

let supabaseClient = null;

let products = [];
let cart = [];
let selectedColors = {};

let currentCategory = "all";
let currentSearch = "";

let toastTimeout;
let checkoutEmAndamento = false;


/* ========================================
   DETECTAR PÁGINA ATUAL
======================================== */

const isCelularesPage = window.location.pathname
    .toLowerCase()
    .endsWith("celulares.html");


/* ========================================
   INICIALIZAÇÃO
======================================== */

async function initializeStore() {
    console.log("Iniciando CyberTech Store...");

    try {
        const { createClient } = await import(
            "https://esm.sh/@supabase/supabase-js@2"
        );

        supabaseClient = createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        );

        await loadProductsFromSupabase();

        products.forEach(product => {
            if (product.colors.length > 0) {
                selectedColors[product.id] = product.colors[0].name;
            }
        });

        renderProducts(products);
        updateCartUI();
        updateCheckoutButton();

        console.log("Loja inicializada!");
    } catch (error) {
        console.error("Erro ao inicializar a loja:", error);

        showGridError(
            "Não foi possível iniciar a loja.",
            "Verifique sua conexão com a internet e recarregue a página."
        );
    }
}


/* ========================================
   INICIAR QUANDO O HTML ESTIVER PRONTO
======================================== */

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeStore);
} else {
    initializeStore();
}


/* ========================================
   MENSAGEM DE ERRO NA GRADE
======================================== */

function showGridError(title, message) {
    const grid = document.getElementById("productGrid");

    if (!grid) return;

    grid.innerHTML = `
        <div class="col-span-full text-center py-16">
            <i class="fa-solid fa-triangle-exclamation text-red-500 text-3xl"></i>
            <h3 class="font-bold mt-4">${escapeHTML(title)}</h3>
            <p class="text-gray-400 text-sm mt-2">${escapeHTML(message)}</p>
            <button
                type="button"
                onclick="location.reload()"
                class="bg-red-600 hover:bg-red-700 px-5 py-3 rounded-xl mt-5 text-sm font-bold">
                Tentar novamente
            </button>
        </div>
    `;
}


/* ========================================
   BUSCAR PRODUTOS DO SUPABASE
======================================== */

async function loadProductsFromSupabase() {
    const grid = document.getElementById("productGrid");

    if (grid) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-16 text-gray-400">
                <i class="fa-solid fa-spinner fa-spin text-red-500 text-3xl"></i>
                <p class="mt-4">Carregando produtos...</p>
            </div>
        `;
    }

    try {
        let query = supabaseClient
            .from("produtos")
            .select("*")
            .eq("ativo", true);

        if (isCelularesPage) {
            query = query.in("categoria", [
                "celular",
                "smartphone",
                "smartphones"
            ]);
        }

        const { data, error } = await query
            .order("id", { ascending: false });

        if (error) {
            throw error;
        }

        products = (data || []).map(item => {
            let colors = item.colors || [];

            if (typeof colors === "string") {
                try {
                    colors = JSON.parse(colors);
                } catch {
                    colors = [];
                }
            }

            if (!Array.isArray(colors)) {
                colors = [];
            }

            colors = colors.map(color => {
                if (typeof color === "string") {
                    return {
                        name: color,
                        hex: "#cccccc",
                        stock: null
                    };
                }

                const colorStock = color.estoque;

                return {
                    name: String(color.name || color.nome || "Cor"),
                    hex: validColor(color.hex),
                    stock: colorStock === undefined || colorStock === null
                        ? null
                        : Number(colorStock)
                };
            });

            return {
                id: item.id,
                name: item.nome || "Produto sem nome",
                category: item.categoria || "celular",
                price_pix: Number(item.preco || 0),
                price_installment: item.preco_parcelado
                    ? Number(item.preco_parcelado)
                    : null,
                image: item.imagem_url || PLACEHOLDER_IMAGE,
                stock: Number(item.estoque || 0),
                colors: colors
            };
        });

        console.log("Supabase conectado!");
        console.log("Produtos encontrados:", products);

    } catch (error) {
        console.error("Erro Supabase:", error);

        products = [];

        showGridError(
            "Erro ao carregar produtos",
            error.message || "Verifique sua conexão com o Supabase e as permissões da tabela."
        );
    }
}


/* ========================================
   VALIDAR COR HEXADECIMAL
======================================== */

function validColor(value) {
    const color = String(value || "");

    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
        return color;
    }

    if (/^#[0-9a-fA-F]{3}$/.test(color)) {
        return color;
    }

    return "#cccccc";
}


/* ========================================
   FORMATAÇÃO DE PREÇO
======================================== */

function money(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}


/* ========================================
   SEGURANÇA PARA TEXTOS
======================================== */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function escapeAttribute(value) {
    return escapeHTML(value);
}


/* ========================================
   RENDERIZAR PRODUTOS
======================================== */

function renderProducts(items) {
    const grid = document.getElementById("productGrid");

    if (!grid) {
        console.warn("Elemento productGrid não encontrado.");
        return;
    }

    grid.innerHTML = "";

    if (!items || items.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-16">
                <i class="fa-solid fa-box-open text-4xl text-gray-600 mb-3"></i>
                <h3 class="font-bold">Nenhum produto encontrado</h3>
                <p class="text-gray-500 text-sm mt-2">
                    Não existem produtos disponíveis nesta categoria.
                </p>
            </div>
        `;
        return;
    }

    items.forEach(product => {
        const colors = Array.isArray(product.colors)
            ? product.colors
            : [];

        const selectedColor =
            selectedColors[product.id] ||
            (colors[0] ? colors[0].name : "");

        const colorButtons = colors.map(color => {
            const selected = color.name === selectedColor;
            const encodedColor = encodeURIComponent(color.name);

            return `
                <button
                    type="button"
                    onclick="selectProductColor(${Number(product.id)}, decodeURIComponent('${encodedColor}'))"
                    title="${escapeAttribute(color.name)}"
                    aria-label="${escapeAttribute(color.name)}"
                    class="color-option ${selected ? "selected" : ""}"
                    style="background:${validColor(color.hex)}">
                </button>
            `;
        }).join("");

        const installmentHTML = product.price_installment
            ? `
                <p class="text-xs text-gray-400 mt-1">
                    ou 12x de ${money(product.price_installment / 12)}
                </p>
            `
            : `
                <p class="text-xs text-gray-400 mt-1">
                    Consulte condições de parcelamento
                </p>
            `;

        const card = document.createElement("article");

        card.className =
            "product-card rounded-2xl overflow-hidden flex flex-col";

        card.innerHTML = `
            <div class="relative bg-[#0d0d11]">
                <span class="absolute top-3 left-3 z-10 bg-red-600/20 text-red-400 border border-red-500/30 text-[10px] font-bold px-2 py-1 rounded-lg uppercase">
                    ${escapeHTML(product.category)}
                </span>

                <img
                    src="${escapeAttribute(product.image)}"
                    alt="${escapeAttribute(product.name)}"
                    class="product-image"
                    loading="lazy"
                    onerror="this.onerror=null;this.src='${PLACEHOLDER_IMAGE}'">
            </div>

            <div class="p-5 flex flex-col flex-1">
                <h3 class="font-bold text-white text-base mb-3">
                    ${escapeHTML(product.name)}
                </h3>

                <div class="mb-4">
                    <p class="text-xs text-gray-400 mb-3">
                        Cor:
                        <strong class="text-white">
                            ${escapeHTML(selectedColor || "Não informada")}
                        </strong>
                    </p>

                    <div class="flex gap-3 items-center flex-wrap">
                        ${colorButtons}
                    </div>
                </div>

                <div class="border-t border-cyber-border pt-4 mt-auto">
                    <p class="text-xs text-gray-400">À vista no PIX</p>

                    <p class="text-xl font-extrabold text-white">
                        ${money(product.price_pix)}
                    </p>

                    ${installmentHTML}

                    <button
                        type="button"
                        onclick="buyProductPagBank(${Number(product.id)})"
                        class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-sm mt-4 flex justify-center items-center gap-2 transition">
                        <i class="fa-solid fa-credit-card text-lg"></i>
                        Comprar agora
                    </button>

                    <button
                        type="button"
                        onclick="addToCart(${Number(product.id)})"
                        class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl text-sm mt-2 transition">
                        <i class="fa-solid fa-cart-plus mr-2"></i>
                        Adicionar ao carrinho
                    </button>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });
}


/* ========================================
   SELECIONAR COR
======================================== */

function selectProductColor(productId, colorName) {
    selectedColors[productId] = colorName;
    applyFilters();
}


/* ========================================
   FILTROS DE CATEGORIA
======================================== */

function filterCategory(category, button) {
    currentCategory = category;

    document.querySelectorAll(".cat-btn").forEach(btn => {
        btn.classList.remove("active", "bg-red-600", "text-white");
        btn.classList.add("border", "border-gray-800");
    });

    if (button) {
        button.classList.add("active", "bg-red-600", "text-white");
        button.classList.remove("border", "border-gray-800");
    }

    applyFilters();
}


/* ========================================
   PESQUISA DESKTOP
======================================== */

function filterProducts() {
    const input = document.getElementById("searchInput");

    if (!input) return;

    currentSearch = input.value.toLowerCase().trim();

    const mobile = document.getElementById("searchMobile");

    if (mobile) {
        mobile.value = input.value;
    }

    applyFilters();
}


/* ========================================
   PESQUISA MOBILE
======================================== */

function filterProductsMobile() {
    const input = document.getElementById("searchMobile");

    if (!input) return;

    currentSearch = input.value.toLowerCase().trim();

    const desktop = document.getElementById("searchInput");

    if (desktop) {
        desktop.value = input.value;
    }

    applyFilters();
}


/* ========================================
   APLICAR FILTROS
======================================== */

function applyFilters() {
    let filtered = [...products];

    if (currentCategory !== "all") {
        filtered = filtered.filter(product =>
            product.category === currentCategory
        );
    }

    if (currentSearch) {
        filtered = filtered.filter(product =>
            product.name.toLowerCase().includes(currentSearch) ||
            product.category.toLowerCase().includes(currentSearch)
        );
    }

    renderProducts(filtered);
}


/* ========================================
   VERIFICAR ESTOQUE NO CARRINHO
======================================== */

function getQuantityInCart(productId, colorName = null) {
    return cart
        .filter(item =>
            item.id == productId &&
            (colorName === null || item.color === colorName)
        )
        .reduce((total, item) => total + item.quantity, 0);
}

function checkAvailableStock(product, colorName, quantityToAdd = 1) {
    const color = product.colors.find(item => item.name === colorName);

    const totalAlreadyInCart = getQuantityInCart(product.id);
    const colorAlreadyInCart = getQuantityInCart(product.id, colorName);

    if (totalAlreadyInCart + quantityToAdd > product.stock) {
        return false;
    }

    if (
        color &&
        color.stock !== null &&
        colorAlreadyInCart + quantityToAdd > color.stock
    ) {
        return false;
    }

    return true;
}


/* ========================================
   ADICIONAR AO CARRINHO
======================================== */

function addToCart(productId) {
    const product = products.find(p => p.id == productId);

    if (!product) return;

    const color = selectedColors[productId] || "";

    if (!color) {
        showToast("Selecione uma cor", "Escolha uma cor antes de adicionar.");
        return;
    }

    if (!checkAvailableStock(product, color, 1)) {
        showToast("Estoque insuficiente", "Não há quantidade disponível para esse produto ou cor.");
        return;
    }

    const existing = cart.find(item =>
        item.id == productId && item.color === color
    );

    if (existing) {
        existing.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price_pix),
            color: color,
            image: product.image,
            quantity: 1
        });
    }

    updateCartUI();
    showToast("Produto adicionado!", product.name);
}


/* ========================================
   ATUALIZAR CARRINHO
======================================== */

function updateCartUI() {
    const list = document.getElementById("cartItemsList");
    const countElement = document.getElementById("cartCount");
    const subtotalElement = document.getElementById("cartSubtotal");
    const totalElement = document.getElementById("cartTotal");

    const count = cart.reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    if (countElement) {
        countElement.textContent = count;
    }

    if (!list) return;

    if (!cart.length) {
        list.innerHTML = `
            <div class="text-center py-16 text-gray-500">
                <i class="fa-solid fa-cart-shopping text-4xl mb-4"></i>
                <p>Seu carrinho está vazio.</p>
            </div>
        `;

        if (subtotalElement) subtotalElement.textContent = money(0);
        if (totalElement) totalElement.textContent = money(0);

        return;
    }

    let total = 0;

    list.innerHTML = "";

    cart.forEach((item, index) => {
        const subtotal = item.price * item.quantity;
        total += subtotal;

        const element = document.createElement("div");

        element.className =
            "flex gap-3 py-4 border-b border-cyber-border";

        element.innerHTML = `
            <img
                src="${escapeAttribute(item.image)}"
                alt="${escapeAttribute(item.name)}"
                class="w-16 h-16 object-contain rounded-lg bg-cyber-bg">

            <div class="flex-1 min-w-0">
                <h4 class="font-bold text-sm">
                    ${escapeHTML(item.name)}
                </h4>

                <p class="text-xs text-red-400 mt-1">
                    Cor: ${escapeHTML(item.color)}
                </p>

                <p class="text-sm font-bold mt-2">
                    ${money(item.price)}
                </p>

                <div class="flex items-center gap-3 mt-2">
                    <button type="button" onclick="updateQuantity(${index},-1)">−</button>
                    <span>${item.quantity}</span>
                    <button type="button" onclick="updateQuantity(${index},1)">+</button>

                    <button type="button" onclick="removeFromCart(${index})" class="ml-auto text-red-500">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;

        list.appendChild(element);
    });

    if (subtotalElement) {
        subtotalElement.textContent = money(total);
    }

    if (totalElement) {
        totalElement.textContent = money(total);
    }
}


/* ========================================
   QUANTIDADE E REMOÇÃO
======================================== */

function updateQuantity(index, delta) {
    if (!cart[index]) return;

    const item = cart[index];

    if (delta > 0) {
        const product = products.find(p => p.id == item.id);

        if (!product || !checkAvailableStock(product, item.color, 1)) {
            showToast("Estoque insuficiente", "Não há mais unidades disponíveis.");
            return;
        }
    }

    item.quantity += delta;

    if (item.quantity <= 0) {
        cart.splice(index, 1);
    }

    updateCartUI();
}

function removeFromCart(index) {
    if (!cart[index]) return;

    cart.splice(index, 1);
    updateCartUI();
}


/* ========================================
   ATUALIZAR BOTÃO DE FINALIZAÇÃO
======================================== */

function updateCheckoutButton() {
    const button = document.querySelector(
        '[onclick="checkoutWhatsApp()"]'
    );

    if (!button) return;

    button.innerHTML = `
        <i class="fa-solid fa-credit-card text-xl"></i>
        Finalizar compra
    `;
}


/* ========================================
   CRIAR CHECKOUT NO PAGBANK
======================================== */

async function createPagBankCheckout(items) {
    if (checkoutEmAndamento) return;

    if (!supabaseClient) {
        showToast("Aguarde", "A loja ainda está carregando.");
        return;
    }

    if (!items.length) {
        showToast("Carrinho vazio", "Adicione produtos primeiro.");
        return;
    }

    checkoutEmAndamento = true;

    try {
        showToast("Preparando pagamento", "Conectando ao PagBank...");

        const { data, error } = await supabaseClient.functions.invoke(
            "criar-pagamento",
            {
                body: {
                    itens: items.map(item => ({
                        produto_id: Number(item.produto_id),
                        cor: String(item.cor),
                        quantidade: Number(item.quantidade)
                    }))
                }
            }
        );

        if (error) {
            let mensagem = error.message || "Não foi possível criar o pagamento.";

            try {
                const resposta = await error.context.json();

                if (resposta.erro) {
                    mensagem = resposta.erro;
                }
            } catch {
                // Mantém a mensagem original.
            }

            throw new Error(mensagem);
        }

        if (!data || data.sucesso !== true || !data.link_pagamento) {
            throw new Error(
                data?.erro || "O PagBank não retornou o link de pagamento."
            );
        }

        const urlPagamento = new URL(data.link_pagamento);

        if (urlPagamento.protocol !== "https:") {
            throw new Error("O endereço de pagamento não é seguro.");
        }

        window.location.assign(urlPagamento.href);

    } catch (error) {
        console.error("Erro ao criar checkout PagBank:", error);

        showToast(
            "Não foi possível iniciar o pagamento",
            error.message || "Tente novamente."
        );

    } finally {
        checkoutEmAndamento = false;
    }
}


/* ========================================
   COMPRAR PRODUTO INDIVIDUAL
======================================== */

function buyProductPagBank(productId) {
    const product = products.find(p => p.id == productId);

    if (!product) return;

    const color = selectedColors[productId] || "";

    if (!color) {
        showToast("Selecione uma cor", "Escolha a cor do produto.");
        return;
    }

    if (!checkAvailableStock(product, color, 1)) {
        showToast("Estoque insuficiente", "Esse produto não possui estoque disponível.");
        return;
    }

    createPagBankCheckout([
        {
            produto_id: product.id,
            cor: color,
            quantidade: 1
        }
    ]);
}


/* ========================================
   FINALIZAR COMPRA DO CARRINHO
======================================== */

async function checkoutPagBank() {
    if (!cart.length) {
        showToast("Carrinho vazio", "Adicione produtos primeiro.");
        return;
    }

    const itens = cart.map(item => ({
        produto_id: item.id,
        cor: item.color,
        quantidade: item.quantity
    }));

    await createPagBankCheckout(itens);
}


/* ========================================
   COMPATIBILIDADE COM O HTML ANTIGO
======================================== */

// O HTML atual chama checkoutWhatsApp().
// Mantemos o nome temporariamente para não quebrar o botão.
// A função agora direciona ao PagBank, sem abrir WhatsApp.

function checkoutWhatsApp() {
    return checkoutPagBank();
}


/* ========================================
   ABRIR E FECHAR CARRINHO
======================================== */

function toggleCart() {
    const drawer = document.getElementById("cartDrawer");

    if (!drawer) return;

    drawer.classList.toggle("hidden");
}


/* ========================================
   NOTIFICAÇÃO
======================================== */

function showToast(title, message) {
    const toast = document.getElementById("toast");
    const titleElement = document.getElementById("toast-title");
    const messageElement = document.getElementById("toast-msg");

    if (!toast || !titleElement || !messageElement) {
        console.log(title, message);
        return;
    }

    titleElement.textContent = title;
    messageElement.textContent = message;

    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}


/* ========================================
   DISPONIBILIZAR FUNÇÕES PARA O HTML
======================================== */

window.filterCategory = filterCategory;
window.filterProducts = filterProducts;
window.filterProductsMobile = filterProductsMobile;

window.selectProductColor = selectProductColor;

window.buyProductPagBank = buyProductPagBank;

window.addToCart = addToCart;
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;

window.checkoutPagBank = checkoutPagBank;
window.checkoutWhatsApp = checkoutWhatsApp;

window.toggleCart = toggleCart;

