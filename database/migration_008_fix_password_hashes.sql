-- Migración 008: el hash placeholder original de los usuarios semilla no correspondía
-- realmente a "123456" (el login comparaba el string plano, nunca el hash).
-- Ahora que auth.js valida con bcrypt de verdad, hay que corregir ese hash.
UPDATE users
SET password = '$2a$10$kRh/5wEI6qiwryQIo0AAqeu5URs8csVeIcQO862mEJbVnasyOY5DS'
WHERE password = '$2a$10$Wy.aX.KIIVr9HYr0E4q6CeKm.R7z6.0UR1s4sJ3BoYlVb4dQjyGZu';
