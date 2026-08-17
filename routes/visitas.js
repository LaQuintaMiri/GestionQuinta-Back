const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');

// Obtener todas las visitas
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('visitas')
      .select('*, clientes(nombre, telefono)')
      .order('fecha_hora_visita', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear una visita con validación de 1:30 hs
router.post('/', async (req, res) => {
  const { cliente_id, nombre_visitante, fecha_hora_visita, motivo, notas, force } = req.body;

  if (!fecha_hora_visita) {
    return res.status(400).json({ error: 'La fecha y hora de la visita es obligatoria.' });
  }

  try {
    const newVisitDate = new Date(fecha_hora_visita);
    const minDiffMs = 90 * 60 * 1000; // 1:30 hs en milisegundos

    // Calcular el rango de conflicto (fecha_hora_visita - 90 mins hasta fecha_hora_visita + 90 mins)
    const rangeStart = new Date(newVisitDate.getTime() - minDiffMs).toISOString();
    const rangeEnd = new Date(newVisitDate.getTime() + minDiffMs).toISOString();

    // Buscar si hay visitas en este rango
    const { data: conflictingVisits, error: searchError } = await supabase
      .from('visitas')
      .select('*, clientes(nombre)')
      .gte('fecha_hora_visita', rangeStart)
      .lte('fecha_hora_visita', rangeEnd);

    if (searchError) throw searchError;

    if (conflictingVisits && conflictingVisits.length > 0 && !force) {
      const conflict = conflictingVisits[0];
      const conflictTime = new Date(conflict.fecha_hora_visita).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const name = conflict.nombre_visitante || (conflict.clientes ? conflict.clientes.nombre : 'Visita sin nombre');

      return res.status(400).json({
        conflict: true,
        message: `Conflicto de horario: Ya existe una visita agendada con ${name} a las ${conflictTime}. Debe haber al menos 1:30 hs de diferencia entre visitas.`,
      });
    }

    // Insertar la visita
    const { data, error } = await supabase
      .from('visitas')
      .insert([
        {
          cliente_id: cliente_id || null,
          nombre_visitante: nombre_visitante || null,
          fecha_hora_visita,
          motivo: motivo || null,
          notes: notas || null, // Nota: el campo de la base de datos se mapea a notas
        },
      ])
      .select();

    if (error) throw error;
    res.status(201).json({ success: true, data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Modificar una visita con validación de 1:30 hs
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { cliente_id, nombre_visitante, fecha_hora_visita, motivo, notas, force } = req.body;

  if (!fecha_hora_visita) {
    return res.status(400).json({ error: 'La fecha y hora de la visita es obligatoria.' });
  }

  try {
    const newVisitDate = new Date(fecha_hora_visita);
    const minDiffMs = 90 * 60 * 1000;

    const rangeStart = new Date(newVisitDate.getTime() - minDiffMs).toISOString();
    const rangeEnd = new Date(newVisitDate.getTime() + minDiffMs).toISOString();

    // Buscar conflictos excluyendo la propia visita actual
    const { data: conflictingVisits, error: searchError } = await supabase
      .from('visitas')
      .select('*, clientes(nombre)')
      .neq('id', id)
      .gte('fecha_hora_visita', rangeStart)
      .lte('fecha_hora_visita', rangeEnd);

    if (searchError) throw searchError;

    if (conflictingVisits && conflictingVisits.length > 0 && !force) {
      const conflict = conflictingVisits[0];
      const conflictTime = new Date(conflict.fecha_hora_visita).toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const name = conflict.nombre_visitante || (conflict.clientes ? conflict.clientes.nombre : 'Visita sin nombre');

      return res.status(400).json({
        conflict: true,
        message: `Conflicto de horario: Ya existe otra visita agendada con ${name} a las ${conflictTime}. Debe haber al menos 1:30 hs de diferencia.`,
      });
    }

    // Actualizar visita
    const { data, error } = await supabase
      .from('visitas')
      .update({
        cliente_id: cliente_id || null,
        nombre_visitante: nombre_visitante || null,
        fecha_hora_visita,
        motivo: motivo || null,
        notes: notas || null,
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar visita
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('visitas').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Visita eliminada correctamente.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
