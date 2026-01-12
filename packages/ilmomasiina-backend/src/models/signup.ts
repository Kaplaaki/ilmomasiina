import moment from "moment";
import {
  DataTypes,
  HasManyAddAssociationMixin,
  HasManyAddAssociationsMixin,
  HasManyCountAssociationsMixin,
  HasManyCreateAssociationMixin,
  HasManyGetAssociationsMixin,
  HasManyHasAssociationMixin,
  HasManyHasAssociationsMixin,
  HasManyRemoveAssociationMixin,
  HasManyRemoveAssociationsMixin,
  HasManySetAssociationsMixin,
  HasOneCreateAssociationMixin,
  HasOneGetAssociationMixin,
  HasOneSetAssociationMixin,
  Model,
  Op,
  Optional,
  Sequelize,
} from "sequelize";

import {
  ManualPaymentStatus,
  PaymentStatus,
  ProductSchema,
  SignupPaymentStatus,
  SignupStatus,
} from "@tietokilta/ilmomasiina-models";
import config from "../config";
import type { Answer } from "./answer";
import type { Payment } from "./payment";
import type { Quota } from "./quota";
import { generateRandomId, RANDOM_ID_LENGTH } from "./randomId";
import { jsonColumnGetter } from "./util/json";

export interface SignupAttributes {
  id: string;
  firstName: string | null;
  lastName: string | null;
  namePublic: boolean;
  email: string | null;
  language: string | null;
  confirmedAt: Date | null;
  status: SignupStatus | null;
  position: number | null;
  /** Total price of the signup in cents, calculated when it was last updated. */
  price: number | null;
  /** The currency in which the price is denominated. */
  currency: string | null;
  /** The product lines used to calculate the price. */
  products: ProductSchema[] | null;
  /** Payment status set manually by an admin, without creating a Payment record. */
  manualPaymentStatus: ManualPaymentStatus | null;
  createdAt: Date;
  quotaId: Quota["id"];
}

export interface SignupCreationAttributes extends Optional<
  SignupAttributes,
  | "id"
  | "firstName"
  | "lastName"
  | "namePublic"
  | "email"
  | "confirmedAt"
  | "language"
  | "status"
  | "position"
  | "price"
  | "currency"
  | "products"
  | "manualPaymentStatus"
  | "createdAt"
> {}

export class Signup extends Model<SignupAttributes, SignupCreationAttributes> implements SignupAttributes {
  public id!: string;
  public firstName!: string | null;
  public lastName!: string | null;
  public namePublic!: boolean;
  public email!: string | null;
  public language!: string | null;
  public confirmedAt!: Date | null;
  public status!: SignupStatus | null;
  public position!: number | null;
  public price!: number | null;
  public currency!: string | null;
  public products!: ProductSchema[] | null;
  public manualPaymentStatus!: ManualPaymentStatus | null;

  public quotaId!: Quota["id"];
  public quota?: Quota;
  public getQuota!: HasOneGetAssociationMixin<Quota>;
  public setQuota!: HasOneSetAssociationMixin<Quota, Quota["id"]>;
  public createQuota!: HasOneCreateAssociationMixin<Quota>;

  public answers?: Answer[];
  public getAnswers!: HasManyGetAssociationsMixin<Answer>;
  public countAnswers!: HasManyCountAssociationsMixin;
  public hasAnswer!: HasManyHasAssociationMixin<Answer, Answer["id"]>;
  public hasAnswers!: HasManyHasAssociationsMixin<Answer, Answer["id"]>;
  public setAnswers!: HasManySetAssociationsMixin<Answer, Answer["id"]>;
  public addAnswer!: HasManyAddAssociationMixin<Answer, Answer["id"]>;
  public addAnswers!: HasManyAddAssociationsMixin<Answer, Answer["id"]>;
  public removeAnswer!: HasManyRemoveAssociationMixin<Answer, Answer["id"]>;
  public removeAnswers!: HasManyRemoveAssociationsMixin<Answer, Answer["id"]>;
  public createAnswer!: HasManyCreateAssociationMixin<Answer>;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public activePayment?: Payment | null;
  public getActivePayment!: HasOneGetAssociationMixin<Payment>;
  public setActivePayment!: HasOneSetAssociationMixin<Payment, Payment["id"]>;
  public createActivePayment!: HasOneCreateAssociationMixin<Payment>;

  public static readonly MAX_NAME_LENGTH = 255;
  public static readonly MAX_EMAIL_LENGTH = 255; // TODO

  /** Gets the time this signup must be confirmed by before it expires. */
  public get confirmableUntil(): Date {
    return new Date(this.createdAt.getTime() + config.signupConfirmMins * 60 * 1000);
  }

  /** Gets the time this signup is editable until, regardless of signups closing. */
  public get editableAtLeastUntil(): Date {
    return config.signupConfirmAfterClose
      ? new Date(this.createdAt.getTime() + config.signupConfirmMins * 60 * 1000)
      : this.createdAt;
  }

  public get hasPrice(): boolean {
    return this.price != null && this.price > 0;
  }

  public get effectivePaymentStatus(): SignupPaymentStatus | null {
    // If the signup is paid either online or manually, it's paid.
    if (this.activePayment?.status === PaymentStatus.PAID || this.manualPaymentStatus === ManualPaymentStatus.PAID)
      return SignupPaymentStatus.PAID;
    // If there is no need to pay, don't check further.
    if (!this.hasPrice) return null;
    // If an active payment exists, use its status.
    if (this.activePayment != null) return Signup.paymentStatusMap[this.activePayment.status];
    // If the manual payment is set, use that.
    if (this.manualPaymentStatus != null) return Signup.manualPaymentStatusMap[this.manualPaymentStatus];
    // Finally, if neither is set, but the signup has a price, it's pending.
    return SignupPaymentStatus.PENDING;
  }

  public static readonly paymentStatusMap: Record<PaymentStatus, SignupPaymentStatus> = {
    [PaymentStatus.CREATING]: SignupPaymentStatus.PENDING,
    [PaymentStatus.PENDING]: SignupPaymentStatus.PENDING,
    [PaymentStatus.PAID]: SignupPaymentStatus.PAID,
    [PaymentStatus.EXPIRED]: SignupPaymentStatus.PENDING,
    [PaymentStatus.CREATION_FAILED]: SignupPaymentStatus.PENDING,
    [PaymentStatus.REFUNDED]: SignupPaymentStatus.REFUNDED,
  };

  public static readonly manualPaymentStatusMap: Record<ManualPaymentStatus, SignupPaymentStatus> = {
    [ManualPaymentStatus.PAID]: SignupPaymentStatus.PAID,
    [ManualPaymentStatus.REFUNDED]: SignupPaymentStatus.REFUNDED,
  };
}

export default function setupSignupModel(sequelize: Sequelize) {
  Signup.init(
    {
      id: {
        type: DataTypes.CHAR(RANDOM_ID_LENGTH),
        primaryKey: true,
        defaultValue: generateRandomId,
      },
      quotaId: {
        type: DataTypes.CHAR(RANDOM_ID_LENGTH),
        allowNull: false,
      },
      firstName: {
        type: DataTypes.STRING,
        validate: {
          notEmpty: true,
        },
      },
      lastName: {
        type: DataTypes.STRING,
        validate: {
          notEmpty: true,
        },
      },
      namePublic: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      email: {
        type: DataTypes.STRING,
        validate: {
          isEmail: true,
        },
      },
      language: {
        type: DataTypes.STRING(8), // allow for language variants
        validate: {
          notEmpty: true,
        },
      },
      confirmedAt: {
        type: DataTypes.DATE(3),
      },
      status: {
        type: DataTypes.ENUM(...Object.values(SignupStatus)),
      },
      position: {
        type: DataTypes.INTEGER,
      },
      price: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      currency: {
        type: DataTypes.STRING(8),
        allowNull: true,
      },
      products: {
        type: DataTypes.JSON,
        allowNull: true,
        get: jsonColumnGetter<ProductSchema[]>("products"),
      },
      manualPaymentStatus: {
        type: DataTypes.ENUM(...Object.values(ManualPaymentStatus)),
        allowNull: true,
      },
      // Add createdAt manually to support milliseconds
      createdAt: {
        type: DataTypes.DATE(3),
        defaultValue: () => new Date(),
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "signup",
      freezeTableName: true,
      paranoid: true,
      scopes: {
        active: () => ({
          where: {
            [Op.or]: {
              // Is confirmed, or is new enough
              confirmedAt: {
                [Op.ne]: null,
              },
              createdAt: {
                [Op.gt]: moment().subtract(config.signupConfirmMins, "minutes").toDate(),
              },
            },
          },
        }),
      },
    },
  );

  return Signup;
}
