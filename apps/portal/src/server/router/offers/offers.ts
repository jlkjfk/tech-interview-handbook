import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import { createRouter } from '../context';

const yoeCategoryMap: Record<number, string> = {
  0: 'Internship',
  1: 'Fresh Grad',
  2: 'Mid',
  3: 'Senior',
};

const getYoeRange = (yoeCategory: number) => {
  return yoeCategoryMap[yoeCategory] === 'Fresh Grad'
    ? { maxYoe: 3, minYoe: 0 }
    : yoeCategoryMap[yoeCategory] === 'Mid'
    ? { maxYoe: 7, minYoe: 4 }
    : yoeCategoryMap[yoeCategory] === 'Senior'
    ? { maxYoe: 100, minYoe: 8 }
    : null; // Internship
};

const ascOrder = '+';
const descOrder = '-';
const sortingKeys = ['monthYearReceived', 'totalCompensation', 'totalYoe'];

const createSortByValidationRegex = () => {
  const startsWithPlusOrMinusOnly = '^[+-]{1}';
  const sortingKeysRegex = sortingKeys.join('|');
  return new RegExp(startsWithPlusOrMinusOnly + '(' + sortingKeysRegex + ')');
};

export const offersRouter = createRouter().query('list', {
  input: z.object({
    companyId: z.string().nullish(),
    dateEnd: z.date().nullish(),
    dateStart: z.date().nullish(),
    limit: z.number().positive(),
    location: z.string(),
    offset: z.number().nonnegative(),
    salaryMax: z.number().nullish(),
    salaryMin: z.number().nonnegative().nullish(),
    sortBy: z.string().regex(createSortByValidationRegex()).nullish(),
    title: z.string().nullish(),
    yoeCategory: z.number().min(0).max(3),
    yoeMax: z.number().max(100).nullish(),
    yoeMin: z.number().min(0).nullish(),
  }),
  async resolve({ ctx, input }) {
    const yoeRange = getYoeRange(input.yoeCategory);
    const yoeMin = input.yoeMin ? input.yoeMin : yoeRange?.minYoe;
    const yoeMax = input.yoeMax ? input.yoeMax : yoeRange?.maxYoe;

    let data = !yoeRange
      ? await ctx.prisma.offersOffer.findMany({
          // Internship
          include: {
            OffersFullTime: {
              include: {
                baseSalary: true,
                bonus: true,
                stocks: true,
                totalCompensation: true,
              },
            },
            OffersIntern: {
              include: {
                monthlySalary: true,
              },
            },
            company: true,
            profile: {
              include: {
                background: true,
              },
            },
          },
          where: {
            AND: [
              {
                location: input.location,
              },
              {
                OffersIntern: {
                  isNot: null,
                },
              },
              {
                OffersFullTime: {
                  is: null,
                },
              },
            ],
          },
        })
      : await ctx.prisma.offersOffer.findMany({
          // Junior, Mid, Senior
          include: {
            OffersFullTime: {
              include: {
                baseSalary: true,
                bonus: true,
                stocks: true,
                totalCompensation: true,
              },
            },
            OffersIntern: {
              include: {
                monthlySalary: true,
              },
            },
            company: true,
            profile: {
              include: {
                background: true,
              },
            },
          },
          where: {
            AND: [
              {
                location: input.location,
              },
              {
                OffersIntern: {
                  is: null,
                },
              },
              {
                OffersFullTime: {
                  isNot: null,
                },
              },
              {
                profile: {
                  background: {
                    totalYoe: {
                      gte: yoeMin,
                      lte: yoeMax,
                    },
                  },
                },
              },
            ],
          },
        });

    // FILTERING
    data = data.filter((offer) => {
      let validRecord = true;

      if (input.companyId) {
        validRecord = validRecord && offer.company.id === input.companyId;
      }

      if (input.title) {
        validRecord =
          validRecord &&
          (offer.OffersFullTime?.title === input.title ||
            offer.OffersIntern?.title === input.title);
      }

      if (input.dateStart && input.dateEnd) {
        validRecord =
          validRecord &&
          offer.monthYearReceived.getTime() >= input.dateStart.getTime() &&
          offer.monthYearReceived.getTime() <= input.dateEnd.getTime();
      }

      if (input.salaryMin && input.salaryMax) {
        const salary = offer.OffersFullTime?.totalCompensation.value
          ? offer.OffersFullTime?.totalCompensation.value
          : offer.OffersIntern?.monthlySalary.value;

        if (!salary) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Total Compensation or Salary not found',
          });
        }

        validRecord =
          validRecord && salary >= input.salaryMin && salary <= input.salaryMax;
      }

      return validRecord;
    });

    // SORTING
    data = data.sort((offer1, offer2) => {
      const defaultReturn =
        offer2.monthYearReceived.getTime() - offer1.monthYearReceived.getTime();

      if (!input.sortBy) {
        return defaultReturn;
      }

      const order = input.sortBy.charAt(0);
      const sortingKey = input.sortBy.substring(1);

      if (order === ascOrder) {
        return (() => {
          if (sortingKey === 'monthYearReceived') {
            return (
              offer1.monthYearReceived.getTime() -
              offer2.monthYearReceived.getTime()
            );
          }

          if (sortingKey === 'totalCompensation') {
            const salary1 = offer1.OffersFullTime?.totalCompensation.value
              ? offer1.OffersFullTime?.totalCompensation.value
              : offer1.OffersIntern?.monthlySalary.value;

            const salary2 = offer2.OffersFullTime?.totalCompensation.value
              ? offer2.OffersFullTime?.totalCompensation.value
              : offer2.OffersIntern?.monthlySalary.value;

            if (!salary1 || !salary2) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Total Compensation or Salary not found',
              });
            }

            return salary1 - salary2;
          }

          if (sortingKey === 'totalYoe') {
            const yoe1 = offer1.profile.background?.totalYoe;
            const yoe2 = offer2.profile.background?.totalYoe;

            if (!yoe1 || !yoe2) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Total years of experience not found',
              });
            }

            return yoe1 - yoe2;
          }

          return defaultReturn;
        })();
      }

      if (order === descOrder) {
        return (() => {
          if (sortingKey === 'monthYearReceived') {
            return (
              offer2.monthYearReceived.getTime() -
              offer1.monthYearReceived.getTime()
            );
          }

          if (sortingKey === 'totalCompensation') {
            const salary1 = offer1.OffersFullTime?.totalCompensation.value
              ? offer1.OffersFullTime?.totalCompensation.value
              : offer1.OffersIntern?.monthlySalary.value;

            const salary2 = offer2.OffersFullTime?.totalCompensation.value
              ? offer2.OffersFullTime?.totalCompensation.value
              : offer2.OffersIntern?.monthlySalary.value;

            if (!salary1 || !salary2) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Total Compensation or Salary not found',
              });
            }

            return salary2 - salary1;
          }

          if (sortingKey === 'totalYoe') {
            const yoe1 = offer1.profile.background?.totalYoe;
            const yoe2 = offer2.profile.background?.totalYoe;

            if (!yoe1 || !yoe2) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Total years of experience not found',
              });
            }

            return yoe2 - yoe1;
          }

          return defaultReturn;
        })();
      }
      return defaultReturn;
    });

    const startRecordIndex: number = input.limit * input.offset;
    const endRecordIndex: number =
      startRecordIndex + input.limit <= data.length
        ? startRecordIndex + input.limit
        : data.length;
    const paginatedData = data.slice(startRecordIndex, endRecordIndex);

    return {
      data: paginatedData,
      paging: {
        currPage: input.offset,
        numOfItemsInPage: paginatedData.length,
        numOfPages: Math.ceil(data.length / input.limit),
        totalNumberOfOffers: data.length,
      },
    };
  },
});
