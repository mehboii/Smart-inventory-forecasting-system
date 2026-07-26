import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import ProductForm from '../components/ProductForm.jsx';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  async function loadProducts() {
    const data = await api('/products');
    setProducts(data.products);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function saveProduct(product) {
    setError('');
    try {
      await api(editing ? `/products/${editing.id}` : '/products', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(product)
      });
      setEditing(null);
      await loadProducts();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product and its sales history?')) return;
    await api(`/products/${id}`, { method: 'DELETE' });
    await loadProducts();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Inventory</h2>
        <p className="text-slate-500">Add, edit, and delete products.</p>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <ProductForm initialProduct={editing} onSubmit={saveProduct} onCancel={() => setEditing(null)} />
      <section className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr><th className="py-2">Name</th><th>SKU</th><th>Category</th><th>Stock</th><th>Reorder</th><th>Cost</th><th>Lead time</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr className="border-t" key={product.id}>
                <td className="py-2 font-medium">{product.name}</td>
                <td>{product.sku}</td>
                <td>{product.category}</td>
                <td>{product.current_stock}</td>
                <td>{product.reorder_point}</td>
                <td>${product.unit_cost}</td>
                <td>{product.lead_time_days} days</td>
                <td className="space-x-2">
                  <button className="text-blue-700" onClick={() => setEditing(product)}>Edit</button>
                  <button className="text-red-700" onClick={() => deleteProduct(product.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
