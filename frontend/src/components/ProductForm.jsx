import { useEffect, useState } from 'react';

const emptyProduct = {
  name: '',
  sku: '',
  category: '',
  current_stock: 0,
  reorder_point: 0,
  unit_cost: 0,
  lead_time_days: 7
};

export default function ProductForm({ initialProduct, onSubmit, onCancel }) {
  const [product, setProduct] = useState(emptyProduct);

  useEffect(() => {
    setProduct(initialProduct || emptyProduct);
  }, [initialProduct]);

  function update(field, value) {
    setProduct((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    onSubmit(product);
  }

  return (
    <form className="card grid gap-3 md:grid-cols-2" onSubmit={submit}>
      <input className="input" placeholder="Product name" value={product.name} onChange={(event) => update('name', event.target.value)} required />
      <input className="input" placeholder="SKU" value={product.sku} onChange={(event) => update('sku', event.target.value)} required />
      <input className="input" placeholder="Category" value={product.category} onChange={(event) => update('category', event.target.value)} required />
      <input className="input" type="number" min="0" placeholder="Current stock" value={product.current_stock} onChange={(event) => update('current_stock', event.target.value)} />
      <input className="input" type="number" min="0" placeholder="Reorder point" value={product.reorder_point} onChange={(event) => update('reorder_point', event.target.value)} />
      <input className="input" type="number" min="0" step="0.01" placeholder="Unit cost (INR)" value={product.unit_cost} onChange={(event) => update('unit_cost', event.target.value)} />
      <input className="input" type="number" min="1" placeholder="Lead time days" value={product.lead_time_days} onChange={(event) => update('lead_time_days', event.target.value)} />
      <div className="flex gap-2 md:col-span-2">
        <button className="btn" type="submit">{initialProduct ? 'Update product' : 'Add product'}</button>
        {initialProduct && <button className="btn-secondary" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
