const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// Obtener todas las plantillas
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('plantillas_whatsapp')
      .select('*')
      .order('titulo', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear plantilla
router.post('/', async (req, res) => {
  const { titulo, mensaje } = req.body;
  if (!titulo || !mensaje) {
    return res.status(400).json({ error: 'El título y el mensaje son obligatorios.' });
  }
  try {
    const { data, error } = await supabase
      .from('plantillas_whatsapp')
      .insert([{ titulo, mensaje }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar plantilla
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { titulo, mensaje } = req.body;
  try {
    const { data, error } = await supabase
      .from('plantillas_whatsapp')
      .update({ titulo, mensaje })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar plantilla
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('plantillas_whatsapp').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Plantilla eliminada correctamente.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
