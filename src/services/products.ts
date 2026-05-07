import { supabase } from '../lib/supabase';
import { createQBOItem } from './qboApi';
import { getQBOConnectionStatus } from './qboAuth';
import type { Product, ProductFilters, CreateProductInput, User } from '../types';

export async function getProducts(filters?: ProductFilters): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('*, created_by_user:users!products_created_by_fkey(id, name, email)')
    .order('name');

  if (filters?.active !== undefined) {
    query = query.eq('active', filters.active);
  }

  if (filters?.billingType) {
    query = query.eq('billing_type', filters.billingType);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching products:', error);
    throw error;
  }

  return data || [];
}

export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, created_by_user:users!products_created_by_fkey(id, name, email)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching product:', error);
    throw error;
  }

  return data;
}

export async function createProduct(
  input: CreateProductInput,
  user: User
): Promise<Product> {
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!userData) {
    throw new Error('User not found');
  }

  let qboItemId: string | null = null;

  const qboStatus = await getQBOConnectionStatus();
  if (qboStatus.connected) {
    try {
      const qboItem = await createQBOItem({
        name: input.name,
        description: input.description || undefined,
        price_amount: input.price_amount,
        billing_type: input.billing_type,
      });
      qboItemId = qboItem.Id;
    } catch (err) {
      console.error('Failed to sync product to QBO:', err);
    }
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      org_id: userData.organization_id,
      name: input.name,
      description: input.description || null,
      price_amount: input.price_amount,
      currency: input.currency || 'USD',
      billing_type: input.billing_type,
      income_account: input.income_account || null,
      provider_item_id: qboItemId,
      provider: qboItemId ? 'quickbooks_online' : null,
      created_by: user.id,
    })
    .select('*, created_by_user:users!products_created_by_fkey(id, name, email)')
    .single();

  if (error) {
    console.error('Error creating product:', error);
    throw error;
  }

  return data;
}

export async function updateProduct(
  id: string,
  updates: Partial<CreateProductInput>,
  _user: User
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, created_by_user:users!products_created_by_fkey(id, name, email)')
    .single();

  if (error) {
    console.error('Error updating product:', error);
    throw error;
  }

  return data;
}

export async function toggleProductActive(
  id: string,
  active: boolean,
  _user: User
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update({
      active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, created_by_user:users!products_created_by_fkey(id, name, email)')
    .single();

  if (error) {
    console.error('Error toggling product active:', error);
    throw error;
  }

  return data;
}

export async function deleteProduct(id: string, _user: User): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ active: false })
    .eq('id', id);

  if (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}