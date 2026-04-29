/**
 * DinoSelect.js
 * @version 1.0.0
 * @author Alejandro Stacul <alestacul60@gmail.com>
 * @license MIT
 * @repository https://github.com/alestacul60/dinoselect
 * * DinoSelect - Una alternativa moderna, ligera a Select2.
 * Desarrollado en Vanilla JS para ofrecer máximo rendimiento sin dependencias.
 * * Características principales:
 * - Server-side processing nativo con scroll infinito.
 * - Búsqueda por fragmentos (Fuzzy-like search).
 * - Cero dependencias (Zero-dependency).
 * - Accesibilidad mediante navegación por teclado.
 */

class DinoSelect {
    constructor(element, options = {}) {
        this.originalSelect = typeof element === 'string' 
            ? document.querySelector(element) 
            : element;
        
        if (!this.originalSelect) throw new Error('Elemento no encontrado');
        
        this.options = {
            placeholder: 'Selecciona una opción...',
            noResultsText: 'No se encontraron resultados',
            loadingText: 'Cargando...',
            allowClear: false,
            searchable: true,
            minCharsForSearch: 1,
            debounceTime: 300,
            serverSide: false,
            endpoint: null,
            perPage: 20,
            customTemplate: null,
            ...options
        };
        
        this.currentPage = 1;
        this.totalPages = 1;
        this.searchTerm = '';
        this.isLoading = false;
        this.hasMore = false;
        this.items = [];
        this.selectedValue = this.originalSelect.value;
        
        this.init();
    }
    
    init() {
        this.createWrapper();
        this.attachEvents();
        this.loadInitialData();
         this.ensureLeftAlignment(); 
    }
    
    createWrapper() {
        // Ocultar select original
        this.originalSelect.style.display = 'none';
        
        // Crear estructura principal
        const wrapper = document.createElement('div');
        wrapper.className = 'simpleselect-wrapper';
        wrapper.setAttribute('data-value', this.selectedValue);
        
        // Campo de búsqueda/caja de selección
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.className = 'simpleselect-input';
        this.searchInput.placeholder = this.options.placeholder;
        this.searchInput.readOnly = !this.options.searchable;
        this.searchInput.autocomplete = 'off';
        
        this.searchInput.style.textAlign = 'left';
        this.searchInput.style.paddingLeft = '12px';
        this.searchInput.style.margin = '0';
        this.searchInput.style.width = '100%';
        this.searchInput.style.boxSizing = 'border-box';
        
        // Dropdown
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'simpleselect-dropdown';
        
        // Lista de opciones
        this.optionsList = document.createElement('div');
        this.optionsList.className = 'simpleselect-options';
        this.dropdown.appendChild(this.optionsList);
        
        // Botón de limpiar
        if (this.options.allowClear) {
            this.clearBtn = document.createElement('button');
            this.clearBtn.className = 'simpleselect-clear';
            this.clearBtn.innerHTML = '✕';
            this.clearBtn.type = 'button';
        }
        
        wrapper.appendChild(this.searchInput);
        if (this.clearBtn) wrapper.appendChild(this.clearBtn);
        wrapper.appendChild(this.dropdown);
        
        this.originalSelect.parentNode.insertBefore(wrapper, this.originalSelect.nextSibling);
        
        this.wrapper = wrapper;
        
        // Agregar estilos base
        this.addStyles();
    }
    
    addStyles() {
        if (document.getElementById('simpleselect-styles')) return;
        
        const styles = `
            <style id="simpleselect-styles">
                .simpleselect-wrapper {
                    position: relative;
                    width: 100%;
                }
                
                .simpleselect-input {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                    cursor: pointer;
                    background: white;
                    text-align: left !important;  /* Forzar izquierda */
                    box-sizing: border-box;
                    margin: 0;  /* Eliminar márgenes */
                    display: block;  /* Forzar comportamiento de bloque */
                }
                
                .simpleselect-input:focus {
                    outline: none;
                    border-color: #4a90e2;
                }
                
                .simpleselect-clear {
                    position: absolute;
                    right: 8px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 14px;
                    color: #999;
                    display: none;
                    padding: 0 4px;
                }
                
                .simpleselect-clear:hover {
                    color: #333;
                }
                
                .simpleselect-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: white;
                    border: 1px solid #ddd;
                    border-top: none;
                    border-radius: 0 0 4px 4px;
                    max-height: 250px;
                    overflow-y: auto;
                    display: none;
                    z-index: 1000;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .simpleselect-dropdown.show {
                    display: block;
                }
                
                .simpleselect-options {
                    text-align: left;
                }
                
                .simpleselect-option {
                    padding: 8px 12px;
                    cursor: pointer;
                    transition: background 0.2s;
                    text-align: left !important;  /* Forzar izquierda */
                    display: block;
                    clear: both;
                    margin: 0;  /* Eliminar márgenes */
                    width: 100%;  /* Ancho completo */
                    box-sizing: border-box;  /* Incluir padding en el ancho */
                }
                
                .simpleselect-option:hover {
                    background: #f5f5f5;
                }
                
                .simpleselect-option.selected {
                    background: #e3f2fd;
                    color: #1976d2;
                }
                
                .simpleselect-option.highlighted {
                    background: #e8e8e8;
                }
                
                .simpleselect-loading, .simpleselect-no-results {
                    padding: 8px 12px;
                    text-align: center;
                    color: #666;
                }
                
                .simpleselect-loader {
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    border: 2px solid #f3f3f3;
                    border-top: 2px solid #4a90e2;
                    border-radius: 50%;
                    animation: simpleselect-spin 1s linear infinite;
                }
                
                /* Resaltar coincidencias en la búsqueda */
                .simpleselect-highlight {
                    background-color: #fff3cd;
                    font-weight: bold;
                }
                
                @keyframes simpleselect-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }
    
    attachEvents() {
        // Toggle dropdown
        this.searchInput.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        
        // Búsqueda
        if (this.options.searchable) {
            let debounceTimer;
            this.searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.searchTerm = e.target.value;
                    this.currentPage = 1;
                    this.loadData();
                }, this.options.debounceTime);
            });
        }
        
        // Cerrar dropdown al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.closeDropdown();
            }
        });
        
        // Limpiar selección
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clear();
            });
        }
        
        // Scroll infinito para server-side
        this.dropdown.addEventListener('scroll', () => {
            if (!this.options.serverSide) return;
            
            const { scrollTop, scrollHeight, clientHeight } = this.dropdown;
            if (scrollTop + clientHeight >= scrollHeight - 50 && 
                !this.isLoading && 
                this.currentPage < this.totalPages) {
                this.currentPage++;
                this.loadData(true);
            }
        });
        
        // Navegación por teclado
        this.searchInput.addEventListener('keydown', (e) => {
            const options = this.optionsList.querySelectorAll('.simpleselect-option');
            const currentHighlight = this.optionsList.querySelector('.simpleselect-option.highlighted');
            let index = Array.from(options).indexOf(currentHighlight);
            
            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (index < options.length - 1) {
                        if (currentHighlight) currentHighlight.classList.remove('highlighted');
                        options[index + 1].classList.add('highlighted');
                        options[index + 1].scrollIntoView({ block: 'nearest' });
                    } else if (options.length > 0 && index === -1) {
                        options[0].classList.add('highlighted');
                        options[0].scrollIntoView({ block: 'nearest' });
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (index > 0) {
                        if (currentHighlight) currentHighlight.classList.remove('highlighted');
                        options[index - 1].classList.add('highlighted');
                        options[index - 1].scrollIntoView({ block: 'nearest' });
                    }
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (currentHighlight) {
                        currentHighlight.click();
                    }
                    break;
                case 'Escape':
                    this.closeDropdown();
                    break;
            }
        });
    }
    
    async loadInitialData() {
        if (!this.options.serverSide) {
            this.loadFromOriginalSelect();
        } else if (this.options.endpoint) {
            await this.loadData();
        }
    }
    
    loadFromOriginalSelect() {
        const items = Array.from(this.originalSelect.options).map(opt => ({
            id: opt.value,
            text: opt.textContent,
            selected: opt.selected
        }));
        
        this.items = items;
        this.renderItems(items);
    }
    
    async loadData(append = false) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading();
        
        try {
            let items = [];
            
            if (this.options.serverSide && this.options.endpoint) {
                const response = await this.fetchServerData();
                items = response.items;
                this.totalPages = response.totalPages || 1;
                this.hasMore = this.currentPage < this.totalPages;
                
                if (append) {
                    this.items = [...this.items, ...items];
                } else {
                    this.items = items;
                }
            } else {
                // Modo cliente - filtrar localmente con búsqueda por fragmentos
                items = this.filterLocalItems();
                this.items = items;
                this.totalPages = 1;
            }
            
            this.renderItems(this.items, append);
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError();
        } finally {
            this.isLoading = false;
        }
    }
    
    async fetchServerData() {
        const params = new URLSearchParams({
            page: this.currentPage,
            per_page: this.options.perPage,
            search: this.searchTerm
        });
        
        const url = `${this.options.endpoint}?${params}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            return {
                items: data.items || [],
                totalPages: data.totalPages || 1,
                totalItems: data.totalItems || 0
            };
        } catch (error) {
            throw new Error('Error fetching data from server');
        }
    }
    
    filterLocalItems() {
        const items = Array.from(this.originalSelect.options).map(opt => ({
            id: opt.value,
            text: opt.textContent,
            selected: opt.selected
        }));
        
        // Si no hay término de búsqueda o no cumple con caracteres mínimos
        if (!this.searchTerm || this.searchTerm.length < this.options.minCharsForSearch) {
            return items;
        }
        
        // Búsqueda por fragmentos (case insensitive)
        const term = this.searchTerm.toLowerCase().trim();
        return items.filter(item => {
            const textLower = item.text.toLowerCase();
            // Busca coincidencias en cualquier parte del texto
            return textLower.includes(term);
        });
    }
    
    highlightSearchTerm(text) {
        if (!this.searchTerm || this.searchTerm.length < this.options.minCharsForSearch) {
            return text;
        }
        
        // Escapar caracteres especiales para regex
        const term = this.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${term})`, 'gi');
        
        return text.replace(regex, '<span class="simpleselect-highlight">$1</span>');
    }
    
    renderItems(items, append = false) {
        if (!append) {
            this.optionsList.innerHTML = '';
        }
        
        if (items.length === 0 && !this.isLoading) {
            const noResults = document.createElement('div');
            noResults.className = 'simpleselect-no-results';
            noResults.textContent = this.options.noResultsText;
            this.optionsList.appendChild(noResults);
            return;
        }
        
        items.forEach(item => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'simpleselect-option';
            if (item.id == this.selectedValue) {
                optionDiv.classList.add('selected');
            }
            
            if (this.options.customTemplate) {
                optionDiv.innerHTML = this.options.customTemplate(item);
            } else {
                // Resaltar el término de búsqueda en el texto
                const displayText = this.highlightSearchTerm(item.text);
                optionDiv.innerHTML = displayText;
            }
            
            optionDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectItem(item);
            });
            
            this.optionsList.appendChild(optionDiv);
        });
        
        if (this.hasMore && this.options.serverSide) {
            const loader = document.createElement('div');
            loader.className = 'simpleselect-loading';
            loader.innerHTML = '<div class="simpleselect-loader"></div> Cargando más...';
            this.optionsList.appendChild(loader);
        }
    }
    
    showLoading() {
        if (this.currentPage === 1) {
            this.optionsList.innerHTML = '';
        }
        
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'simpleselect-loading';
        loadingDiv.innerHTML = `<div class="simpleselect-loader"></div> ${this.options.loadingText}`;
        
        if (this.currentPage === 1) {
            this.optionsList.appendChild(loadingDiv);
        }
    }
    
    showError() {
        this.optionsList.innerHTML = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'simpleselect-no-results';
        errorDiv.textContent = 'Error al cargar los datos';
        this.optionsList.appendChild(errorDiv);
    }
    
    selectItem(item) {
        this.selectedValue = item.id;
        this.searchInput.value = item.text;
        this.originalSelect.value = item.id;
        
        // Forzar alineación izquierda de forma más agresiva
        this.searchInput.style.textAlign = 'left';
        this.searchInput.style.paddingLeft = '12px';  // Forzar padding izquierdo
        this.searchInput.style.margin = '0';
        this.searchInput.style.width = '100%';
        this.searchInput.style.boxSizing = 'border-box';
        
        // Disparar evento change
        const changeEvent = new Event('change', { bubbles: true });
        this.originalSelect.dispatchEvent(changeEvent);
        
        this.closeDropdown();
        this.updateSelectedClass();
        
        if (this.clearBtn) {
            this.clearBtn.style.display = 'block';
        }
    }
    
    updateSelectedClass() {
        const options = this.optionsList.querySelectorAll('.simpleselect-option');
        options.forEach(opt => {
            opt.classList.remove('selected');
            // Comparar por texto plano (sin HTML)
            if (opt.textContent === this.searchInput.value) {
                opt.classList.add('selected');
            }
        });
    }
    
    clear() {
        this.selectedValue = '';
        this.searchInput.value = '';
        this.originalSelect.value = '';
        
        // Resetear alineación con estilos forzados
        this.searchInput.style.textAlign = 'left';
        this.searchInput.style.paddingLeft = '12px';
        this.searchInput.style.margin = '0';
        this.searchInput.style.width = '100%';
        
        const changeEvent = new Event('change', { bubbles: true });
        this.originalSelect.dispatchEvent(changeEvent);
        
        if (this.clearBtn) {
            this.clearBtn.style.display = 'none';
        }
        
        this.searchTerm = '';
        this.loadData();
        this.closeDropdown();
    }
    
    toggleDropdown() {
        if (this.dropdown.classList.contains('show')) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }
    
    openDropdown() {
        this.dropdown.classList.add('show');
        this.loadData();
    }
    
    closeDropdown() {
        this.dropdown.classList.remove('show');
        if (this.options.searchable && this.searchTerm) {
            this.searchTerm = '';
            this.searchInput.value = this.selectedValue 
                ? this.getSelectedText() 
                : '';
            this.currentPage = 1;
            this.loadData();
        }
    }
    
    getSelectedText() {
        const selectedOption = this.originalSelect.options[this.originalSelect.selectedIndex];
        return selectedOption ? selectedOption.textContent : '';
    }
    
    getTextFromValue(value) {
        const option = Array.from(this.originalSelect.options).find(opt => opt.value == value);
        return option ? option.textContent : '';
    }
    
    // Métodos públicos
    setValue(value) {
        const text = this.getTextFromValue(value);
        if (text) {
            this.selectItem({ id: value, text: text });
        }
    }
    
    getValue() {
        return this.selectedValue;
    }
    
    destroy() {
        this.wrapper.remove();
        this.originalSelect.style.display = '';
    }
    
    reload() {
        this.currentPage = 1;
        this.searchTerm = '';
        this.searchInput.value = '';
        this.loadData();
    }
    ensureLeftAlignment() {
        if (this.searchInput) {
            this.searchInput.style.textAlign = 'left';
            this.searchInput.style.paddingLeft = '12px';
            this.searchInput.style.paddingRight = (this.clearBtn ? '28px' : '12px');
            this.searchInput.style.margin = '0';
            this.searchInput.style.width = '100%';
            this.searchInput.style.boxSizing = 'border-box';
        }
    }
}
