import { DataTypes } from "sequelize";

import { PaymentStatus } from "@tietokilta/ilmomasiina-models";
import { defineMigration } from "./util";

export default defineMigration({
  name: "0009-add-payments",
  async up({ context: { sequelize, transaction } }) {
    const query = sequelize.getQueryInterface();
    await query.createTable(
      "payment",
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          allowNull: false,
          primaryKey: true,
        },
        signupId: {
          type: DataTypes.STRING,
          allowNull: false,
          references: {
            model: "signup",
            key: "id",
          },
          // Signups with payments should never be deleted. TODO: how to handle expired ones
          onDelete: "RESTRICT",
          onUpdate: "RESTRICT",
        },
        stripeCheckoutSessionId: {
          type: DataTypes.STRING,
          allowNull: true,
          unique: true,
        },
        status: {
          type: DataTypes.ENUM(...Object.values(PaymentStatus)),
          allowNull: false,
          defaultValue: PaymentStatus.CREATING,
        },
        amount: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        currency: {
          type: DataTypes.CHAR(8),
          allowNull: false,
        },
        products: {
          type: DataTypes.JSON,
          allowNull: false,
        },
        expiresAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        completedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      },
      { transaction },
    );
    await query.addColumn(
      "signup",
      "activePaymentId",
      {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: "payment",
          key: "id",
        },
        // Deleting/renumbering payments is not allowed anyway, but this shouldn't hurt.
        onDelete: "RESTRICT",
        onUpdate: "RESTRICT",
      },
      { transaction },
    );
  },
  async down({ context: { sequelize, transaction } }) {
    const query = sequelize.getQueryInterface();
    await query.removeColumn("signup", "activePaymentId", { transaction });
    await query.dropTable("payment", { transaction });
  },
});
