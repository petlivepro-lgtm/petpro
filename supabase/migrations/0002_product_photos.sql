-- Até 5 fotos por produto. Mantém photo_path como capa (= photos[0]).
alter table product add column photos text[] not null default '{}';

-- Preserva as fotos já existentes na galeria.
update product set photos = array[photo_path]
  where photo_path is not null and photos = '{}';
