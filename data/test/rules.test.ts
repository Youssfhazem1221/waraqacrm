import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonPhone, shippingFee, zoneFor, mergeTag, nextOrderId, customerStats, nowCairo } from '../src/rules.ts';

const zones = [
  { zone: 'Cairo & Giza', governorates: ['cairo', 'giza', 'القاهرة', 'الجيزة'], fee: 60, freeOver: 800, courierCost: 80 },
  { zone: 'Rest of Egypt', governorates: ['*'], fee: 75, freeOver: 0, courierCost: 80 },
];

test('canonPhone normalises every Egyptian mobile spelling', () => {
  for (const v of ['01022320257', '+201022320257', '00201022320257', '201022320257', '1022320257', '٠١٠٢٢٣٢٠٢٥٧', '010 2232 0257']) {
    assert.equal(canonPhone(v), '01022320257', v);
  }
  assert.equal(canonPhone('12345'), '12345');
  assert.equal(canonPhone(''), '');
});

test('shipping follows zones, free-over only where set', () => {
  assert.equal(shippingFee(zones, 500, 'Cairo'), 60);
  assert.equal(shippingFee(zones, 800, 'Giza'), 0);
  assert.equal(shippingFee(zones, 800, 'Cairo · Nasr City'), 0);
  assert.equal(shippingFee(zones, 800, 'القاهرة'), 0);
  assert.equal(shippingFee(zones, 5000, 'Alexandria'), 75);
  assert.equal(zoneFor(zones, 'Aswan')?.zone, 'Rest of Egypt');
  assert.equal(zoneFor(zones, '')?.zone, 'Rest of Egypt');
});

test('tags only move up and manual tags survive', () => {
  assert.equal(mergeTag('', 1), 'New');
  assert.equal(mergeTag('New', 2), 'Repeat');
  assert.equal(mergeTag('VIP', 1), 'VIP');
  assert.equal(mergeTag('Risk', 5), 'Risk');
});

test('order ids continue from the highest number', () => {
  assert.equal(nextOrderId([]), 'WRQ-1001');
  assert.equal(nextOrderId([{ id: 'WRQ-1009' }, { id: 'WRQ-1003' }]), 'WRQ-1010');
});

test('customer stats skip cancelled orders and returned spend', () => {
  const base = { customerName: 'A', email: '', governorate: 'Cairo', city: '', address: 'x', itemsSummary: '', totalQty: 1, subtotal: 100, shippingCharged: 0, courierCost: 0, payment: '', whatsappSent: false, statusUpdatedAt: '', notes: '', lang: 'en' as const };
  const st = customerStats([
    { ...base, id: 'WRQ-1', createdAt: '2026-10-01 10:00', phone: '01022320257', total: 100, status: 'Delivered' },
    { ...base, id: 'WRQ-2', createdAt: '2026-10-05 10:00', phone: '+201022320257', total: 200, status: 'Returned' },
    { ...base, id: 'WRQ-3', createdAt: '2026-10-07 10:00', phone: '1022320257', total: 300, status: 'Cancelled' },
  ]).get('01022320257')!;
  assert.equal(st.orders, 2);
  assert.equal(st.spent, 100);
  assert.equal(st.firstOrder, '2026-10-01');
  assert.equal(st.lastOrder, '2026-10-07');
});

test('nowCairo formats as sortable text', () => {
  assert.match(nowCairo(new Date('2026-11-09T16:30:00Z')), /^2026-11-09 18:30$/);
});
