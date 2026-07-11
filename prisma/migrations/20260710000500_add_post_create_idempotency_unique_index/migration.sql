CREATE UNIQUE INDEX CONCURRENTLY "post_campus_id_author_id_client_mutation_id_key"
ON "post"("campus_id", "author_id", "client_mutation_id");
