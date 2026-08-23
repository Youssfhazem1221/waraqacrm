import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import type { Product, Order, Customer, OrderStatus, ActiveTab } from '@/types';
import { 
  fetchProductsData, 
  fetchOrdersData, 
  fetchCustomersData,
  saveProductToBackend,
  deleteProductFromBackend,
  updateStockQuick,
  updateOrderStatusInBackend,
  logWhatsAppSent,
  updateCustomerInBackend,
  computeAnalytics,
  verifyToken,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  type WriteResult
} from '@/lib/api';

import Sidebar from '@/components/layout/Sidebar';
import TopHeader from '@/components/layout/TopHeader';
import OverviewStats from '@/components/dashboard/OverviewStats';
import SLAAlertBanner from '@/components/dashboard/SLAAlertBanner';
import OrderKanban from '@/components/orders/OrderKanban';
import CatalogTable from '@/components/inventory/CatalogTable';
import CustomerDirectory from '@/components/customers/CustomerDirectory';

// Loaded on demand. None of these are on screen when the CRM opens — the
// analytics and settings tabs need a click, and the modals need a selection —
// so keeping them out of the initial bundle gets the dashboard painted sooner.
const UnitEconomics = lazy(() => import('@/components/analytics/UnitEconomics'));
const PostHogDashboard = lazy(() => import('@/components/analytics/PostHogDashboard'));
const SyncSettings = lazy(() => import('@/components/settings/SyncSettings'));
const OrderDetailModal = lazy(() => import('@/components/orders/OrderDetailModal'));
const WhatsAppModal = lazy(() => import('@/components/orders/WhatsAppModal'));
const ProductEditorModal = lazy(() => import('@/components/inventory/ProductEditorModal'));
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

function PanelSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-live="polite">
      <div className="h-24 bg-white border border-[#E6D9C7] rounded-2xl" />
      <div className="h-64 bg-white border border-[#E6D9C7] rounded-2xl" />
    </div>
  );
}

function AppContent() {
  const [token, setTokenState] = useState<string>(getStoredToken());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(Boolean(getStoredToken()));
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [allowOffline, setAllowOffline] = useState(false);

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
      // Fired together, not one after another. These are three independent Apps
      // Script round-trips; awaiting them in sequence made every refresh take
      // as long as all three combined.
      //
      // The order/customer reads are issued even with no token: they fall back
      // to the local cache in that case, which is what makes the offline mode
      // show anything at all.
      const [pRes, oRes, cRes] = await Promise.all([
        fetchProductsData(),
        fetchOrdersData(token),
        fetchCustomersData(token),
      ]);

      setProducts(pRes.products);
      // "Live" only if the authenticated reads landed too — otherwise the
      // header claimed a live connection while showing cached orders.
      setIsLive(pRes.isLive && (!token || oRes.isLive));

      setOrders(oRes.orders);
      setCustomers(cRes.customers);
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
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = authPassword.trim();
    if (!cleanToken) {
      setAuthError('Please enter your secret admin token');
      return;
    }

    // The token is checked against the backend before we let anyone in. It used
    // to be accepted unconditionally, so a typo signed you into a CRM that
    // quietly showed bundled demo data and silently failed every write.
    setIsVerifying(true);
    setAuthError('');
    const check = await verifyToken(cleanToken);
    setIsVerifying(false);

    if (!check.ok) {
      setAuthError(check.error ?? 'Could not verify that token.');
      setAllowOffline(true);
      return;
    }

    setStoredToken(cleanToken);
    setTokenState(cleanToken);
    setIsAuthenticated(true);
    setAuthPassword('');
    addToast('success', 'Admin Command Hub Unlocked', 'Syncing operational data with backend.');
  };

  /** Explicit opt-in to working against cached data with no backend. */
  const handleContinueOffline = () => {
    setIsAuthenticated(true);
    setTokenState('');
    setAuthError('');
    addToast(
      'info',
      'Working offline',
      'Showing the last cached data. Changes stay on this device until you sign in with a valid token.'
    );
  };

  const handleLock = () => {
    clearStoredToken();
    setTokenState('');
    setIsAuthenticated(false);
    addToast('info', 'Command Hub Locked');
  };

  /**
   * Report the outcome of a write.
   *
   * Every action below used to fire a success toast *before* awaiting the
   * backend and then throw the result away — so "Removed from Google Sheets and
   * the storefront" appeared even when the sheet never received the change, and
   * the operator would only find out days later by opening the spreadsheet.
   * The screen still updates immediately (that responsiveness is worth keeping),
   * but the confirmation now waits for the write and says so when it fails.
   */
  const reportWrite = useCallback(
    (result: WriteResult, successTitle: string, successMessage: string, subject: string) => {
      if (result.synced) {
        addToast('success', successTitle, successMessage);
      } else {
        addToast(
          'error',
          `Not saved to Google Sheets: ${subject}`,
          `${result.error ?? 'The backend did not confirm the change.'} The change is showing locally only — press Refresh to see the real sheet state.`
        );
      }
    },
    [addToast]
  );

  // Actions
  const handleQuickStock = async (sku: string, newStock: number, status: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.sku === sku ? { ...p, stock: newStock, status: status as Product['status'] } : p))
    );
    const res = await updateStockQuick(sku, newStock, status, token);
    reportWrite(res, `Stock updated: ${sku}`, `New inventory: ${newStock} units (${status})`, sku);
  };

  const handleSaveProduct = async (product: Product) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.sku === product.sku);
      if (exists) {
        return prev.map((p) => (p.sku === product.sku ? product : p));
      }
      return [product, ...prev];
    });
    const res = await saveProductToBackend(product, token);
    reportWrite(res, `SKU Saved: ${product.sku}`, `${product.name} updated.`, product.sku);
  };

  const handleDeleteProduct = async (sku: string) => {
    setProducts((prev) => prev.filter((p) => p.sku !== sku));
    const res = await deleteProductFromBackend(sku, token);
    reportWrite(res, `SKU Deleted: ${sku}`, 'Removed from Google Sheets and the storefront.', sku);
  };

  const handleUpdateCustomerTag = async (phone: string, tag: Customer['Customer Tag']) => {
    setCustomers((prev) =>
      prev.map((c) => (c['Phone (WhatsApp)'] === phone ? { ...c, 'Customer Tag': tag } : c))
    );
    const res = await updateCustomerInBackend(phone, { tag }, token);
    reportWrite(res, 'Customer tag updated', `Segment set to ${tag}.`, phone);
  };

  const handleOrderStatusChange = async (orderId: string, status: OrderStatus) => {
    const previous = orders.find((o) => o['Order ID'] === orderId)?.Status;

    setOrders((prev) =>
      prev.map((o) => (o['Order ID'] === orderId ? { ...o, Status: status } : o))
    );
    if (detailOrder && detailOrder['Order ID'] === orderId) {
      setDetailOrder((prev) => (prev ? { ...prev, Status: status } : null));
    }

    const res = await updateOrderStatusInBackend(orderId, status, token);

    // Fulfilment stage drives what actually gets packed and shipped, so a
    // rejected write is rolled back rather than left looking applied.
    if (!res.synced && previous) {
      setOrders((prev) =>
        prev.map((o) => (o['Order ID'] === orderId ? { ...o, Status: previous } : o))
      );
      setDetailOrder((prev) =>
        prev && prev['Order ID'] === orderId ? { ...prev, Status: previous } : prev
      );
    }

    reportWrite(
      res,
      `Order #${orderId} Updated`,
      `Fulfillment stage changed to ${status}.`,
      `order #${orderId}`
    );
  };

  const handleLogWhatsApp = async (orderId: string, sent: boolean) => {
    setOrders((prev) =>
      prev.map((o) => (o['Order ID'] === orderId ? { ...o, 'WhatsApp sent?': sent ? 'Yes' : 'No' } : o))
    );
    const res = await logWhatsAppSent(orderId, sent, token);
    reportWrite(
      res,
      'WhatsApp Outreach Logged',
      `Order #${orderId} marked as sent in records.`,
      `order #${orderId}`
    );
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

            <Button type="submit" size="lg" className="w-full" disabled={isVerifying}>
              <span>{isVerifying ? 'Checking token...' : 'Unlock Command Hub'}</span>
            </Button>
          </form>

          {allowOffline ? (
            <div className="space-y-2">
              <p className="text-[11px] text-[#6B5D50]">
                No backend reachable? You can inspect the last cached data without signing in.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleContinueOffline}
              >
                <span>Continue offline (read-only data)</span>
              </Button>
            </div>
          ) : (
            <p className="text-[11px] text-[#6B5D50]">
              Your token must match ADMIN_TOKEN in the deployed Apps Script.
            </p>
          )}
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
                onDeleteProduct={handleDeleteProduct}
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
                onUpdateTag={handleUpdateCustomerTag}
              />
            </div>
          )}

          {/* TAB 5: Financials & Unit Economics */}
          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-fadeIn">
              <Suspense fallback={<PanelSkeleton />}>
                <UnitEconomics metrics={metrics} />
                <div className="mt-8">
                  <PostHogDashboard />
                </div>
              </Suspense>
            </div>
          )}

          {/* TAB 6: Settings */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fadeIn">
              <Suspense fallback={<PanelSkeleton />}>
                <SyncSettings onSettingsSaved={loadAllData} />
              </Suspense>
            </div>
          )}
        </main>
      </div>

      {/* Modals — mounted only once something is selected, so their chunks are
          fetched on first use rather than at startup. */}
      <Suspense fallback={null}>
        {detailOrder && (
          <OrderDetailModal
            isOpen
            onClose={() => setDetailOrder(null)}
            order={detailOrder}
            onStatusChange={handleOrderStatusChange}
            onOpenWhatsApp={(o) => setWhatsAppOrder(o)}
          />
        )}

        {whatsAppOrder && (
          <WhatsAppModal
            isOpen
            onClose={() => setWhatsAppOrder(null)}
            order={whatsAppOrder}
            onLogWhatsApp={handleLogWhatsApp}
          />
        )}

        {isProductModalOpen && (
          <ProductEditorModal
            isOpen
            onClose={() => {
              setIsProductModalOpen(false);
              setEditingProduct(null);
            }}
            product={editingProduct}
            existingSkus={products.map((p) => p.sku)}
            onSave={handleSaveProduct}
          />
        )}
      </Suspense>
    </div>
  );
}
