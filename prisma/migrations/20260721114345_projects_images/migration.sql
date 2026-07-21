-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wall_width" DOUBLE PRECISION NOT NULL DEFAULT 300,
    "wall_height" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "wall_unit" TEXT NOT NULL DEFAULT 'cm',
    "ruler_length" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "ruler_visible" BOOLEAN NOT NULL DEFAULT true,
    "ruler_color" TEXT NOT NULL DEFAULT '#ffcc00',
    "bg_enabled" BOOLEAN NOT NULL DEFAULT false,
    "bg_color" TEXT NOT NULL DEFAULT '#2a2a2a',
    "bg_project_too" BOOLEAN NOT NULL DEFAULT false,
    "default_image_width" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "default_frame_enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_frame_color" TEXT NOT NULL DEFAULT 'black',
    "default_frame_width" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "grid_enabled" BOOLEAN NOT NULL DEFAULT false,
    "grid_size" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "grid_project_too" BOOLEAN NOT NULL DEFAULT false,
    "nail_enabled" BOOLEAN NOT NULL DEFAULT false,
    "nail_color" TEXT NOT NULL DEFAULT '#ff3b3b',
    "nail_size" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "keystone_enabled" BOOLEAN NOT NULL DEFAULT false,
    "keystone_vertical" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "keystone_horizontal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "images" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "local_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "src" TEXT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "x_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "w_pct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "h_pct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "natural_w" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "natural_h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frame_enabled" BOOLEAN NOT NULL DEFAULT false,
    "frame_color" TEXT NOT NULL DEFAULT 'black',
    "frame_width" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "aspect_locked" BOOLEAN NOT NULL DEFAULT true,
    "crop" BOOLEAN NOT NULL DEFAULT false,
    "snap_to_grid" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nails" (
    "id" TEXT NOT NULL,
    "image_id" TEXT NOT NULL,
    "x_cm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y_cm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "nails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_user_id_idx" ON "projects"("user_id");

-- CreateIndex
CREATE INDEX "images_project_id_idx" ON "images"("project_id");

-- CreateIndex
CREATE INDEX "nails_image_id_idx" ON "nails"("image_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nails" ADD CONSTRAINT "nails_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE CASCADE ON UPDATE CASCADE;
