import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Product, Order, Customer, OrderStatus, ActiveTab } from '@/types';
import { 
  fetchProductsData, 
  fetchOrdersData, 
  fetchCustomersData, 
  saveProductToBackend, 
  updateStockQuick, 
  updateOrderStatusInBackend, 
  logWhatsAppSent, 
  computeAnalytics,
  getStoredToken,
  setStoredToken,
  clearStoredToken
} from '@/lib/api';

import Sidebar from '@/components/layout/Sidebar';
import TopHeader from '@/components/layout/TopHeader';
import OverviewStats from '@/components/dashboard/OverviewStats';
import SLAAlertBanner from '@/components/dashboard/SLAAlertBanner';
import OrderKanban from '@/components/orders/OrderKanban';
import CatalogTable from '@/components/inventory/CatalogTable';
import CustomerDirectory from '@/components/customers/CustomerDirectory';
import UnitEconomics from '@/components/analytics/UnitEconomics';
import SyncSettings from '@/components/settings/SyncSettings';

import OrderDetailModal from '@/components/orders/OrderDetailModal';
import WhatsAppModal from '@/components/orders/WhatsAppModal';
import ProductEditorModal from '@/components/inventory/ProductEditorModal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import WaraqaLogo from '@/components/ui/WaraqaLogo';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import ToastContainer, { type ToastMessage } from '@/components/ui/Toast';
import { Lock, Plus, RefreshCw, ShoppingBag, Package, Sparkles } from 'lucide-react';

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [token, setTokenState] = useState<string>(getStoredToken());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(Boolean(getStoredToken()));
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: 'success' | 'error' | 'info', title: string, message?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev.slice(-3), { id, type, title, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Modal States
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [whatsAppOrder, setWhatsAppOrder] = useState<Order | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);

  // Load data
  const loadAllData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const pRes = await fetchProductsData();
      setProducts(pRes.products);
      setIsLive(pRes.isLive);

      if (token) {
        const oRes = await fetchOrdersData(token);
        setOrders(oRes.orders);

        const cRes = await fetchCustomersData(token);
        setCustomers(cRes.customers);
      }
    } catch (err) {
      console.warn('[Waraqa CRM] Error loading CRM data:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [token]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Auth unlock
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authPassword.trim()) {
      setAuthError('Please enter your secret admin token');
      return;
    }
    const cleanToken = authPassword.trim();
    setStoredToken(cleanToken);
    setTokenState(cleanToken);
    setIsAuthenticated(true);
    setAuthError('');
    addToast('success', 'Admin Command Hub Unlocked', 'Syncing operational data with backend.');
  };

  const handleLock = () => {
    clearStoredToken();
    setTokenState('');
    setIsAuthenticated(false);
    addToast('info', 'Command Hub Locked');
  };

  // Actions
  const handleQuickStock = async (sku: string, newStock: number, status: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.sku === sku ? { ...p, stock: newStock, status: status as Product['status'] } : p))
    );
    addToast('success', `Stock updated: ${sku}`, `New inventory: ${newStock} units (${status})`);
    await updateStockQuick(sku, newStock, status, token);
  };

  const handleSaveProduct = async (product: Product) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.sku === product.sku);
      if (exists) {
        return prev.map((p) => (p.sku === product.sku ? product : p));
      }
      return [product, ...prev];
    });
    addToast('success', `SKU Saved: ${product.sku}`, `${product.name} updated.`);
    await saveProductToBackend(product, token);
  };

  const handleOrderStatusChange = async (orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o['Order ID'] === orderId ? { ...o, Status: status } : o))
    );
    if (detailOrder && detailOrder['Order ID'] === orderId) {
      setDetailOrder((prev) => (prev ? { ...prev, Status: status } : null));
    }
    addToast('success', `Order #${orderId} Updated`, `Fulfillment stage changed to ${status}.`);
    await updateOrderStatusInBackend(orderId, status, token);
  };

  const handleLogWhatsApp = async (orderId: string, sent: boolean) => {
    setOrders((prev) =>
      prev.map((o) => (o['Order ID'] === orderId ? { ...o, 'WhatsApp sent?': sent ? 'Yes' : 'No' } : o))
    );
    addToast('success', `WhatsApp Outreach Logged`, `Order #${orderId} marked as sent in records.`);
    await logWhatsAppSent(orderId, sent, token);
  };

  // Filtered lists
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase().trim();
    return orders.filter(
      (o) =>
        String(o['Order ID'] || '').toLowerCase().includes(q) ||
        String(o['Customer name'] || '').toLowerCase().includes(q) ||
        String(o['Phone (WhatsApp)'] || '').includes(q) ||
        String(o['Governorate/City'] || '').toLowerCase().includes(q) ||
        String(o['Items summary'] || '').toLowerCase().includes(q)
    );
  }, [orders, searchQuery]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase().trim();
    return products.filter(
      (p) =>
        String(p.name || '').toLowerCase().includes(q) ||
        String(p.nameAr || '').includes(q) ||
        String(p.sku || '').toLowerCase().includes(q) ||
        String(p.size || '').toLowerCase().includes(q) ||
        String(p.paperType || '').toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const pendingOrders = orders.filter((o) => (o.Status || 'Pending') === 'Pending');
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const metrics = useMemo(() => computeAnalytics(orders, customers, products), [orders, customers, products]);

  // Auth Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF5EE] flex items-center justify-center p-4">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <div className="w-full max-w-md bg-white border border-[#E6D9C7] rounded-3xl p-8 shadow-sm space-y-6 text-center animate-fadeIn">
          <WaraqaLogo size={64} className="mx-auto rounded-2xl shadow-md" />

          <div className="space-y-1">
            <span className="text-[11px] font-mono text-[#6B5D50] uppercase tracking-widest">
              Workshop Command Portal
            </span>
            <h1 className="font-serif text-3xl font-bold text-[#241C1B]">
              Waraqa CRM
            </h1>
            <p className="text-xs text-[#6B5D50]">
              Enter your admin token to sync with Google Sheets &amp; manage operations.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4 text-left">
            <Input
              label="Admin Token"
              type="password"
              placeholder="Enter your secret token..."
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              error={authError}
              required
            />

            <Button type="submit" size="lg" className="w-full">
              <span>Unlock Command Hub</span>
            </Button>
          </form>

          <p className="text-[11px] text-[#6B5D50]">
            For demo testing without backend, enter any password.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FAF5EE]">
      {/* Toast System */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingOrdersCount={pendingOrders.length}
        lowStockCount={lowStockCount}
        onLock={handleLock}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <TopHeader
          title={
            activeTab === 'dashboard'
              ? 'Workshop Overview'
              : activeTab === 'orders'
              ? 'Order Fulfillment Pipeline'
              : activeTab === 'inventory'
              ? 'Catalog & Inventory Studio'
              : activeTab === 'customers'
              ? 'Customer Directory & LTV'
              : activeTab === 'analytics'
              ? 'Financials & Unit Economics'
              : 'Backend Sync Settings'
          }
          subtitle={
            activeTab === 'dashboard'
              ? 'Real-time sales, order SLA alerts, and workshop capacity'
              : activeTab === 'orders'
              ? 'Manage COD stages from 24h SLA confirmation to delivery'
              : activeTab === 'inventory'
              ? 'Edit SKUs, adjust live pricing, and update stock counts'
              : activeTab === 'customers'
              ? 'Track repeat collectors, customer spend, and regional coverage'
              : activeTab === 'analytics'
              ? 'Profit margins, AOV sweet-spots, and courier reconciliations'
              : 'Configure your Google Apps Script Web App connection'
          }
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isLive={isLive}
          isSyncing={isSyncing}
          onRefresh={loadAllData}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onNewAction={
            activeTab === 'inventory'
              ? () => {
                  setEditingProduct(null);
                  setIsProductModalOpen(true);
                }
              : undefined
          }
          newActionLabel={activeTab === 'inventory' ? '+ New SKU' : undefined}
        />

        {/* Tab Content Body */}
        <main className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto">
          {/* TAB 1: Dashboard Overview */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fadeIn">
              <SLAAlertBanner
                pendingOrders={pendingOrders}
                onOpenOrder={(o) => setDetailOrder(o)}
                onOpenWhatsApp={(o) => setWhatsAppOrder(o)}
              />

              <OverviewStats metrics={metrics} />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-[#241C1B]">
                      Active Order Pipeline
                    </h2>
                    <p className="text-xs text-[#6B5D50]">
                      Move orders through stages or click WhatsApp to contact customers
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('orders')}
                  >
                    <span>View All Orders</span>
                  </Button>
                </div>

                <OrderKanban
                  orders={filteredOrders}
                  onOpenOrder={(o) => setDetailOrder(o)}
                  onOpenWhatsApp={(o) => setWhatsAppOrder(o)}
                  onAdvanceStatus={handleOrderStatusChange}
                />
              </div>
            </div>
          )}

          {/* TAB 2: Order Pipeline */}
          {activeTab === 'orders' && (
            <div className="space-y-6 animate-fadeIn">
              <SLAAlertBanner
                pendingOrders={pendingOrders}
                onOpenOrder={(o) => setDetailOrder(o)}
                onOpenWhatsApp={(o) => setWhatsAppOrder(o)}
              />

              <OrderKanban
                orders={filteredOrders}
                onOpenOrder={(o) => setDetailOrder(o)}
                onOpenWhatsApp={(o) => setWhatsAppOrder(o)}
                onAdvanceStatus={handleOrderStatusChange}
              />
            </div>
          )}

          {/* TAB 3: Inventory & Catalog Studio */}
          {activeTab === 'inventory' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl font-bold text-[#241C1B]">
                    Active SKU Catalog
                  </h2>
                  <p className="text-xs text-[#6B5D50]">
                    Real-time stock stepper &amp; pricing editor. Updating here syncs with Google Sheets and the website storefront.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setEditingProduct(null);
                    setIsProductModalOpen(true);
                  }}
                  icon={<Plus size={16} />}
                >
                  <span>Launch New SKU Format</span>
                </Button>
              </div>

              <CatalogTable
                products={filteredProducts}
                onEditProduct={(p) => {
                  setEditingProduct(p);
                  setIsProductModalOpen(true);
                }}
                onQuickStockChange={handleQuickStock}
              />
            </div>
          )}

          {/* TAB 4: Customer Directory */}
          {activeTab === 'customers' && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="font-serif text-xl font-bold text-[#241C1B]">
                  Customer Database &amp; LTV Intelligence
                </h2>
                <p className="text-xs text-[#6B5D50]">
                  Track repeat buyers, order frequency, and direct WhatsApp relationships.
                </p>
              </div>

              <CustomerDirectory
                customers={customers}
                searchQuery={searchQuery}
              />
            </div>
          )}

          {/* TAB 5: Financials & Unit Economics */}
          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-fadeIn">
              <UnitEconomics metrics={metrics} />
            </div>
          )}

          {/* TAB 6: Settings */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fadeIn">
              <SyncSettings onSettingsSaved={loadAllData} />
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <OrderDetailModal
        isOpen={Boolean(detailOrder)}
        onClose={() => setDetailOrder(null)}
        order={detailOrder}
        onStatusChange={handleOrderStatusChange}
        onOpenWhatsApp={(o) => setWhatsAppOrder(o)}
      />

      <WhatsAppModal
        isOpen={Boolean(whatsAppOrder)}
        onClose={() => setWhatsAppOrder(null)}
        order={whatsAppOrder}
        onLogWhatsApp={handleLogWhatsApp}
      />

      <ProductEditorModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
        onSave={handleSaveProduct}
      />
    </div>
  );
}
