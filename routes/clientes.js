const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// Obtener todos los clientes
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear cliente
router.post('/', async (req, res) => {
  const { nombre, telefono, email, notas } = req.body;
  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
  }

  try {
    const { data, error } = await supabase
      .from('clientes')
      .insert([{ nombre, telefono, email, notas }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar cliente
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, email, notas } = req.body;
  try {
    const { data, error } = await supabase
      .from('clientes')
      .update({ nombre, telefono, email, notas })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar cliente
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: 'Cliente eliminado correctamente.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
