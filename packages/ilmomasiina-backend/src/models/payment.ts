import { DataTypes, Model, Optional, Sequelize } from "sequelize";

import { PaymentStatus } from "@tietokilta/ilmomasiina-models/dist/enum";
import { PaymentAttributes } from "@tietokilta/ilmomasiina-models/dist/models";
import { jsonColumnGetter } from "./util/json";

// TODO: This is a bit unconsistent with other models, since others don't define createdAt at all in
//  the FooAttributes interface. It still shouldn't be passed to Model<> since we want the Sequelize
//  defaults for it.
interface PaymentManualAttributes extends Omit<PaymentAttributes, "createdAt" | "updatedAt"> {}

export interface PaymentCreateAttributes
  extends Optional<PaymentManualAttributes, "id" | "stripeCheckoutSessionId" | "status" | "completedAt"> {}

export class Payment extends Model<PaymentManualAttributes, PaymentCreateAttributes> implements PaymentAttributes {
  public id!: number;
  public signupId!: string;
  public stripeCheckoutSessionId!: string;
  public status!: PaymentStatus;
  public amount!: number;
  public currency!: string;
  public products!: unknown;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly expiresAt!: Date;
  public completedAt!: Date | null;
}

export default function setupPaymentModel(sequelize: Sequelize) {
  Payment.init(
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
      },
      stripeCheckoutSessionId: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM(...Object.values(PaymentStatus)),
        allowNull: false,
        defaultValue: PaymentStatus.PENDING,
      },
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      currency: {
        type: DataTypes.CHAR(8),
        allowNull: false,
      },
      products: {
        type: DataTypes.JSON,
        allowNull: false,
        get: jsonColumnGetter<string | string[]>("products"),
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "payment",
      freezeTableName: true,
      // TODO: We eventually don't want to allow deletion at all, but this won't hurt until we migrate to Postgres only.
      paranoid: true,
    },
  );
}
