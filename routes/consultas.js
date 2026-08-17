const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// Helper para buscar o crear cliente
async function findOrCreateClient({ nombre, telefono, email }) {
  if (!nombre) return null;

  // Intentar buscar cliente por nombre o teléfono
  let query = supabase.from('clientes').select('id');
  if (telefono) {
    query = query.or(`nombre.eq."${nombre}",telefono.eq."${telefono}"`);
  } else {
    query = query.eq('nombre', nombre);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (data && data.length > 0) {
    return data[0].id;
  }

  // Si no existe, crear uno nuevo
  const { data: newClient, error: createError } = await supabase
    .from('clientes')
    .insert([{ nombre, telefono, email }])
    .select();

  if (createError) throw createError;
  return newClient[0].id;
}

// Obtener consultas
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('consultas')
      .select('*, clientes(*)')
      .order('fecha_interes', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear consulta
router.post('/', async (req, res) => {
  let { cliente_id, nombre, telefono, email, fecha_interes, notas, estado } = req.body;

  if (!fecha_interes) {
    return res.status(400).json({ error: 'La fecha de interés es obligatoria.' });
  }

  try {
    // Si no viene cliente_id pero viene nombre, buscar o crear cliente
    if (!cliente_id && nombre) {
      cliente_id = await findOrCreateClient({ nombre, telefono, email });
    }

    if (!cliente_id) {
      return res.status(400).json({ error: 'Debes seleccionar un cliente existente o ingresar el nombre de uno nuevo.' });
    }

    const { data, error } = await supabase
      .from('consultas')
      .insert([
        {
          cliente_id,
          fecha_interes,
          estado: estado || 'pendiente',
          notas,
        },
      ])
      .select('*, clientes(*)');

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar consulta
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { estado, notas, fecha_interes } = req.body;

  try {
    const { data, error } = await supabase
      .from('consultas')
      .update({ estado, notas, fecha_interes })
      .eq('id', id)
      .select('*, clientes(*)');

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar consulta
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('consultas').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Consulta eliminada correctamente.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
