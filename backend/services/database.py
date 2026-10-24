import sqlite3
from datetime import datetime


DATABASE_NAME = "accisafe.db"


def get_connection():
    connection = sqlite3.connect(DATABASE_NAME)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    connection = get_connection()

    # =========================================================
    # ACCIDENTS TABLE
    # =========================================================

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS accidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            acceleration REAL NOT NULL,
            speed_before REAL NOT NULL,
            speed_after REAL NOT NULL,
            tilt_angle REAL NOT NULL,
            observation_seconds INTEGER NOT NULL,
            status TEXT NOT NULL,
            stage INTEGER NOT NULL,
            message TEXT NOT NULL,
            user_id TEXT
        )
        """
    )

    # =========================================================
    # EMERGENCY CONTACTS TABLE
    # =========================================================

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS emergency_contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            relationship TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            user_id TEXT
        )
        """
    )

    # =========================================================
    # NOTIFICATIONS TABLE
    # =========================================================

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            accident_id INTEGER,
            contact_id INTEGER,
            contact_name TEXT NOT NULL,
            contact_phone TEXT NOT NULL,
            message TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            status TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            user_id TEXT
        )
        """
    )

    # =========================================================
    # MIGRATE EXISTING DATABASES
    # =========================================================

    def add_column_if_missing(
        table_name,
        column_name,
        column_definition,
    ):
        columns = connection.execute(
            f"PRAGMA table_info({table_name})"
        ).fetchall()

        existing_columns = {
            column[1]
            for column in columns
        }

        if column_name not in existing_columns:
            connection.execute(
                f"""
                ALTER TABLE {table_name}
                ADD COLUMN {column_name}
                {column_definition}
                """
            )

    add_column_if_missing(
        "accidents",
        "user_id",
        "TEXT",
    )

    add_column_if_missing(
        "emergency_contacts",
        "user_id",
        "TEXT",
    )

    add_column_if_missing(
        "notifications",
        "user_id",
        "TEXT",
    )

    connection.commit()
    connection.close()


# =============================================================
# ACCIDENT FUNCTIONS
# =============================================================

def save_accident(
    sensor_data,
    detection_result,
    user_id=None,
):
    connection = get_connection()

    cursor = connection.execute(
        """
        INSERT INTO accidents (
            timestamp,
            latitude,
            longitude,
            acceleration,
            speed_before,
            speed_after,
            tilt_angle,
            observation_seconds,
            status,
            stage,
            message,
            user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            datetime.now().isoformat(),
            sensor_data.latitude,
            sensor_data.longitude,
            sensor_data.acceleration,
            sensor_data.speed_before,
            sensor_data.speed_after,
            sensor_data.tilt_angle,
            sensor_data.observation_seconds,
            detection_result["status"],
            detection_result["stage"],
            detection_result["message"],
            user_id,
        ),
    )

    accident_id = cursor.lastrowid

    connection.commit()
    connection.close()

    return accident_id

def update_accident_status(
    accident_id: int,
    status: str,
    message: str,
    user_id=None,
):
    connection = get_connection()

    cursor = connection.execute(
        """
        UPDATE accidents
        SET
            status = ?,
            message = ?
        WHERE id = ?
          AND user_id = ?
        """,
        (
            status,
            message,
            accident_id,
            user_id,
        ),
    )

    connection.commit()
    connection.close()

    return cursor.rowcount > 0

def get_all_accidents(user_id=None):
    connection = get_connection()

    if user_id:
        rows = connection.execute(
            """
            SELECT *
            FROM accidents
            WHERE user_id = ?
            ORDER BY id DESC
            """,
            (user_id,),
        ).fetchall()
    else:
        rows = connection.execute(
            """
            SELECT *
            FROM accidents
            WHERE user_id IS NULL
            ORDER BY id DESC
            """
        ).fetchall()

    connection.close()

    return [dict(row) for row in rows]

def get_all_accidents_for_admin():
    connection = get_connection()

    rows = connection.execute(
        """
        SELECT *
        FROM accidents
        ORDER BY id DESC
        """
    ).fetchall()

    connection.close()

    return [dict(row) for row in rows]

def get_emergency_contact(
    contact_id: int,
    user_id=None,
):
    connection = get_connection()

    if user_id:
        row = connection.execute(
            """
            SELECT *
            FROM emergency_contacts
            WHERE id = ?
              AND user_id = ?
            """,
            (
                contact_id,
                user_id,
            ),
        ).fetchone()
    else:
        row = connection.execute(
            """
            SELECT *
            FROM emergency_contacts
            WHERE id = ?
              AND user_id IS NULL
            """,
            (contact_id,),
        ).fetchone()

    connection.close()

    if row is None:
        return None

    return dict(row)

# =============================================================
# EMERGENCY CONTACT FUNCTIONS
# =============================================================

def add_emergency_contact(
    name: str,
    phone: str,
    relationship: str,
    user_id=None,
):
    connection = get_connection()

    cursor = connection.execute(
        """
        INSERT INTO emergency_contacts (
            name,
            phone,
            relationship,
            active,
            created_at,
            user_id
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            name,
            phone,
            relationship,
            1,
            datetime.now().isoformat(),
            user_id,
        ),
    )

    contact_id = cursor.lastrowid

    connection.commit()
    connection.close()

    return contact_id

def get_active_emergency_contacts(user_id=None):
    connection = get_connection()

    if user_id:
        rows = connection.execute(
            """
            SELECT *
            FROM emergency_contacts
            WHERE active = 1
              AND user_id = ?
            ORDER BY id ASC
            """,
            (user_id,),
        ).fetchall()
    else:
        rows = connection.execute(
            """
            SELECT *
            FROM emergency_contacts
            WHERE active = 1
              AND user_id IS NULL
            ORDER BY id ASC
            """
        ).fetchall()

    connection.close()

    return [dict(row) for row in rows]


def get_all_emergency_contacts(user_id=None):
    connection = get_connection()

    if user_id:
        rows = connection.execute(
            """
            SELECT *
            FROM emergency_contacts
            WHERE user_id = ?
            ORDER BY id ASC
            """,
            (user_id,),
        ).fetchall()
    else:
        rows = connection.execute(
            """
            SELECT *
            FROM emergency_contacts
            WHERE user_id IS NULL
            ORDER BY id ASC
            """
        ).fetchall()

    connection.close()

    return [dict(row) for row in rows]


def update_emergency_contact(
    contact_id: int,
    name: str,
    phone: str,
    relationship: str,
    active: bool,
    user_id=None,
):
    connection = get_connection()

    cursor = connection.execute(
        """
        UPDATE emergency_contacts
        SET
            name = ?,
            phone = ?,
            relationship = ?,
            active = ?
        WHERE id = ?
          AND user_id = ?
        """,
        (
            name,
            phone,
            relationship,
            1 if active else 0,
            contact_id,
            user_id,
        ),
    )

    connection.commit()
    connection.close()

    return cursor.rowcount > 0


def delete_emergency_contact(
    contact_id: int,
    user_id=None,
):
    connection = get_connection()

    cursor = connection.execute(
        """
        DELETE FROM emergency_contacts
        WHERE id = ?
          AND user_id = ?
        """,
        (
            contact_id,
            user_id,
        ),
    )

    connection.commit()
    connection.close()

    return cursor.rowcount > 0


# =============================================================
# NOTIFICATION FUNCTIONS
# =============================================================

def save_notification(
    accident_id,
    contact_id,
    contact_name,
    contact_phone,
    message,
    latitude,
    longitude,
    status="GENERATED",
    user_id=None,
):
    connection = get_connection()

    cursor = connection.execute(
        """
        INSERT INTO notifications (
            accident_id,
            contact_id,
            contact_name,
            contact_phone,
            message,
            latitude,
            longitude,
            status,
            timestamp,
            user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            accident_id,
            contact_id,
            contact_name,
            contact_phone,
            message,
            latitude,
            longitude,
            status,
            datetime.now().isoformat(),
            user_id,
        ),
    )

    notification_id = cursor.lastrowid

    connection.commit()
    connection.close()

    return notification_id


def get_all_notifications(user_id=None):
    connection = get_connection()

    if user_id:
        rows = connection.execute(
            """
            SELECT *
            FROM notifications
            WHERE user_id = ?
            ORDER BY id DESC
            """,
            (user_id,),
        ).fetchall()
    else:
        rows = connection.execute(
            """
            SELECT *
            FROM notifications
            WHERE user_id IS NULL
            ORDER BY id DESC
            """
        ).fetchall()

    connection.close()

    return [dict(row) for row in rows]