(function () {
    "use strict";

    const CART_KEY = "novaMarketCart";
    const scriptUrl = document.currentScript.src;
    const appUrl = new URL(".", scriptUrl);
    let products = [];
    let cart = readCart();

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (character) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
            }[character];
        });
    }

    function formatPrice(value) {
        return "$ " + Number(value).toLocaleString("es-CO");
    }

    function readCart() {
        try {
            const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
            if (!Array.isArray(saved)) {
                throw new Error("El formato guardado del carrito no es válido.");
            }

            return saved.reduce(function (items, entry) {
                if (entry && typeof entry.id === "string" && Number.isInteger(entry.quantity) && entry.quantity > 0) {
                    items[entry.id] = entry.quantity;
                }
                return items;
            }, {});
        } catch (error) {
            console.error("No se pudo leer el carrito guardado.", error);
            showMessage("No se pudo leer el carrito guardado. Puedes seguir agregando productos.", "warning");
            return {};
        }
    }

    function saveCart() {
        try {
            localStorage.setItem(CART_KEY, JSON.stringify(
                Object.keys(cart).map(function (id) {
                    return { id: id, quantity: cart[id] };
                })
            ));
        } catch (error) {
            console.error("No se pudo guardar el carrito.", error);
            showMessage("No se pudo guardar el carrito en este navegador. Revisa la configuración de almacenamiento.", "danger");
        }
        updateCartBadge();
    }

    function showMessage(message, type) {
        let container = document.getElementById("app-message");
        if (!container) {
            container = document.createElement("div");
            container.id = "app-message";
            container.className = "container mt-3";
            const main = document.querySelector("main");
            if (main && main.parentElement) {
                main.parentElement.insertBefore(container, main);
            } else {
                document.body.appendChild(container);
            }
        }
        container.innerHTML = "";
        const alert = document.createElement("div");
        alert.className = "alert alert-" + type + " mb-0";
        alert.setAttribute("role", "status");
        alert.textContent = message;
        container.appendChild(alert);
    }

    function updateCartBadge() {
        const count = Object.keys(cart).reduce(function (total, id) {
            return total + cart[id];
        }, 0);

        document.querySelectorAll('a[href*="Carrito.html"]').forEach(function (link) {
            const label = link.querySelector("span");
            if (!label || label.textContent.trim() !== "Carrito") {
                return;
            }
            let badge = link.querySelector(".cart-count");
            if (!badge) {
                badge = document.createElement("span");
                badge.className = "cart-count badge rounded-pill bg-danger ms-1";
                link.appendChild(badge);
            }
            badge.textContent = String(count);
            badge.setAttribute("aria-label", count + (count === 1 ? " producto en el carrito" : " productos en el carrito"));
        });
    }

    function addToCart(id) {
        cart[id] = (cart[id] || 0) + 1;
        saveCart();
        renderCart();
        showMessage("Producto agregado al carrito.", "success");
    }

    function makeProductCard(product) {
        const imageUrl = new URL(product.image, appUrl).href;
        const column = document.createElement("div");
        column.className = "col";
        column.innerHTML =
            '<article class="card h-100 p-2 shadow-sm">' +
                '<img src="' + escapeHtml(imageUrl) + '" class="card-img-top rounded object-fit-contain" alt="' + escapeHtml(product.name) + '" loading="lazy" style="height: 190px;">' +
                '<div class="card-body d-flex flex-column p-2">' +
                    '<small class="text-muted d-block mb-1">' + escapeHtml(product.brand) + '</small>' +
                    '<h2 class="h6 fw-bold mb-2">' + escapeHtml(product.name) + '</h2>' +
                    '<p class="fs-5 fw-bold mb-3">' + formatPrice(product.price) + '</p>' +
                    '<button type="button" class="btn btn-primary w-100 fw-semibold mt-auto" data-add-to-cart="' + escapeHtml(product.id) + '">Agregar al carrito</button>' +
                '</div>' +
            '</article>';
        return column;
    }

    function renderCatalog(items) {
        const pageName = decodeURIComponent(location.pathname.split("/").pop() || "index.html");
        const isHome = pageName.toLowerCase() === "index.html";
        const isCart = pageName.toLowerCase() === "carrito.html";
        if (isCart) {
            renderCart();
            return;
        }

        const grid = document.querySelector(isHome
            ? "main .row.row-cols-1.row-cols-md-3.g-3"
            : "#productos .row.row-cols-1.row-cols-md-3.g-3");
        if (!grid) {
            return;
        }

        const categoryItems = isHome
            ? items.filter(function (product) { return product.featured; }).slice(0, 12)
            : items.filter(function (product) {
                return product.category.toLowerCase() === pageName.replace(/\.html$/i, "").toLowerCase();
            });
        const searchField = document.getElementById("campoBusqueda");
        const priceRange = document.getElementById("rangoPrecio");
        const sortSelect = document.querySelector(".bg-white.rounded-3 select");
        let maxPrice = Infinity;

        function applyFilters() {
            const query = searchField ? normalize(searchField.value.trim()) : "";
            let visible = categoryItems.filter(function (product) {
                const matchesQuery = !query || normalize(product.name + " " + product.brand).includes(query);
                return matchesQuery && product.price <= maxPrice;
            });

            if (sortSelect && sortSelect.selectedIndex === 1) {
                visible.sort(function (a, b) { return a.price - b.price; });
            } else if (sortSelect && sortSelect.selectedIndex === 2) {
                visible.sort(function (a, b) { return b.price - a.price; });
            }

            grid.replaceChildren();
            visible.forEach(function (product) {
                grid.appendChild(makeProductCard(product));
            });

            const countLabel = grid.parentElement.querySelector(".bg-white.rounded-3 .fw-bold");
            if (countLabel) {
                countLabel.textContent = visible.length + (visible.length === 1 ? " producto" : " productos");
            }
            if (visible.length === 0) {
                const empty = document.createElement("p");
                empty.className = "col-12 text-muted py-4";
                empty.textContent = "No encontramos productos para esta búsqueda.";
                grid.appendChild(empty);
            }
        }

        function normalize(value) {
            return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        }

        if (searchField) {
            searchField.addEventListener("input", applyFilters);
            const form = searchField.closest("form");
            if (form) {
                form.addEventListener("submit", function (event) {
                    event.preventDefault();
                    applyFilters();
                });
            }
        }
        if (priceRange) {
            priceRange.addEventListener("input", function () {
                maxPrice = Number(priceRange.value);
                applyFilters();
            });
        }
        if (sortSelect) {
            sortSelect.addEventListener("change", applyFilters);
        }
        applyFilters();
    }

    function renderCart() {
        const list = document.getElementById("cart-items");
        if (!list) {
            return;
        }

        list.replaceChildren();
        let total = 0;
        const selected = Object.keys(cart).map(function (id) {
            return {
                product: products.find(function (product) { return product.id === id; }),
                quantity: cart[id]
            };
        }).filter(function (entry) {
            return entry.product;
        });

        selected.forEach(function (entry) {
            const product = entry.product;
            total += product.price * entry.quantity;
            const row = document.createElement("article");
            row.className = "card mb-3";
            row.innerHTML =
                '<div class="row g-0 align-items-center p-3">' +
                    '<div class="col-4 col-md-2"><img src="' + escapeHtml(new URL(product.image, appUrl).href) + '" class="img-fluid rounded object-fit-contain" alt="' + escapeHtml(product.name) + '" style="height: 110px; width: 100%;" loading="lazy"></div>' +
                    '<div class="col-8 col-md-5 ps-3"><h2 class="h6 fw-bold">' + escapeHtml(product.name) + '</h2><p class="small text-muted mb-1">' + escapeHtml(product.brand) + '</p><strong>' + formatPrice(product.price) + '</strong></div>' +
                    '<div class="col-7 col-md-3 mt-3 mt-md-0 d-flex align-items-center gap-2">' +
                        '<button type="button" class="btn btn-outline-secondary btn-sm" data-cart-action="decrease" data-id="' + escapeHtml(product.id) + '" aria-label="Quitar una unidad">−</button>' +
                        '<span aria-label="Cantidad">' + entry.quantity + '</span>' +
                        '<button type="button" class="btn btn-outline-secondary btn-sm" data-cart-action="increase" data-id="' + escapeHtml(product.id) + '" aria-label="Agregar una unidad">+</button>' +
                    '</div>' +
                    '<div class="col-5 col-md-2 text-end mt-3 mt-md-0"><button type="button" class="btn btn-link text-danger p-0" data-cart-action="remove" data-id="' + escapeHtml(product.id) + '">Eliminar</button></div>' +
                '</div>';
            list.appendChild(row);
        });

        const empty = document.getElementById("cart-empty");
        const summary = document.getElementById("cart-summary");
        if (empty) {
            empty.classList.toggle("d-none", selected.length > 0);
        }
        if (summary) {
            summary.classList.toggle("d-none", selected.length === 0);
        }
        const totalElement = document.getElementById("cart-total");
        if (totalElement) {
            totalElement.textContent = formatPrice(total);
        }
        updateCartBadge();
    }

    document.addEventListener("click", function (event) {
        const addButton = event.target.closest("[data-add-to-cart]");
        if (addButton) {
            addToCart(addButton.dataset.addToCart);
            return;
        }

        const cartButton = event.target.closest("[data-cart-action]");
        if (cartButton) {
            const id = cartButton.dataset.id;
            const action = cartButton.dataset.cartAction;
            if (action === "increase") {
                cart[id] = (cart[id] || 0) + 1;
            } else if (action === "decrease") {
                cart[id] = (cart[id] || 0) - 1;
                if (cart[id] <= 0) {
                    delete cart[id];
                }
            } else if (action === "remove") {
                delete cart[id];
            }
            saveCart();
            renderCart();
            return;
        }

        if (event.target.closest("#cart-clear")) {
            cart = {};
            saveCart();
            renderCart();
        }
    });

    window.addEventListener("storage", function (event) {
        if (event.key === CART_KEY) {
            cart = readCart();
            updateCartBadge();
            renderCart();
        }
    });

    updateCartBadge();

    fetch(new URL("data.json", appUrl))
        .then(function (response) {
            if (!response.ok) {
                throw new Error("No se pudo cargar data.json (HTTP " + response.status + ").");
            }
            return response.json();
        })
        .then(function (data) {
            if (!Array.isArray(data)) {
                throw new Error("El catálogo data.json debe contener una lista de productos.");
            }
            products = data;
            renderCatalog(products);
        })
        .catch(function (error) {
            console.error("Error al cargar el catálogo de productos.", error);
            showMessage("No fue posible cargar el catálogo. Abre el proyecto con un servidor local (por ejemplo, Live Server) y verifica data.json.", "danger");
            const list = document.getElementById("cart-items");
            if (list) {
                list.textContent = "No fue posible cargar los productos del carrito.";
            }
        });
})();

