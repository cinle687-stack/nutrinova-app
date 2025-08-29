const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

const sql = neon(process.env.NETLIFY_DATABASE_URL);

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Verificar token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Token requerido' })
      };
    }

    const decoded = verifyToken(token);
    const userId = decoded.userId;

    const { responses } = JSON.parse(event.body || '{}');

    // Marcar encuesta como completada
    await sql`
      UPDATE users 
      SET survey_completed = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${userId}
    `;

    // Guardar respuestas de la encuesta
    if (responses && Array.isArray(responses)) {
      for (const response of responses) {
        await sql`
          INSERT INTO survey_responses (user_id, question, answer)
          VALUES (${userId}, ${response.question}, ${response.answer})
        `;
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Encuesta completada exitosamente' 
      })
    };
  } catch (error) {
    console.error('Complete survey error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error del servidor' })
    };
  }
};