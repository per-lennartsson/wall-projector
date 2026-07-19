"""add image content_hash

Revision ID: 41ebe29067e6
Revises: 079f7107662b
Create Date: 2026-07-19 22:21:14.600834

"""
import hashlib
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '41ebe29067e6'
down_revision: Union[str, None] = '079f7107662b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('images', sa.Column('content_hash', sa.String(length=64), nullable=True))

    # Backfill existing rows before making the column NOT NULL — mirrors
    # routers/projects.py's content_hash = sha256(src).hexdigest().
    conn = op.get_bind()
    images = sa.table('images', sa.column('id', sa.UUID()), sa.column('src', sa.Text()), sa.column('content_hash', sa.String()))
    for row in conn.execute(sa.select(images.c.id, images.c.src)):
        conn.execute(
            images.update()
            .where(images.c.id == row.id)
            .values(content_hash=hashlib.sha256(row.src.encode()).hexdigest())
        )

    op.alter_column('images', 'content_hash', nullable=False)


def downgrade() -> None:
    op.drop_column('images', 'content_hash')
