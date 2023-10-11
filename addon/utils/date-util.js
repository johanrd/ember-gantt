import { isArray, A } from "@ember/array";
import { get } from "@ember/object";
import { isNone, isEqual, isEmpty } from "@ember/utils";
import { htmlSafe } from '@ember/template';


/**
 * The date-util contains some helpful date-functions to work with dates and calculate time-periods.
 *
 * @class DateUtil
 * @namespace Utils
 * @public
 */
export default {

  /**
   * Get new date (from given date) and without time!
   *
   * @method getNewDate
   * @param {Date}  fromDate
   * @return {Date} cloned date with 0 time TZ
   * @public
   */
  getNewDate(fromDate) {
    let date = null;

    if (fromDate && typeof fromDate.getTime === 'function') {
      date = new Date(fromDate.getTime());

    } else if (typeof fromDate === 'string' && !isNaN(fromDate)) {
      date = new Date(parseInt(fromDate));

    } else if (typeof fromDate === 'number' || typeof fromDate === 'string') {
      date = new Date(fromDate);
    }

    if (isNone(fromDate)) {
      date = new Date();
    }

    date = this.dateNoTime(date);
    return date;
  },

  /**
   * Remove time from date (set 0)
   *
   * @method dateNoTime
   * @param {Date}  date
   * @return {Date} date without time
   * @public
   */
  dateNoTime(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  },

  /**
   * Generate new date from given date + given number of days
   *
   * @method datePlusDays
   * @param {Date}  date
   * @param {int}   days
   * @return {Date} cloned date n-days later
   * @public
   */
  datePlusDays(date, days) {
    let newDate = this.getNewDate(date);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
  },

  /**
   * Calculate number of days in a month
   *
   * @method daysInMonth
   * @param {Date}  date  date of day in that month
   * @return {int} number of days in that month (28-31)
   * @public
   */
  daysInMonth(date) {
    let newDate = this.getNewDate(date);
    newDate.setMonth(newDate.getMonth()+1);
    newDate.setDate(0);  // set to last day of previous month
    return newDate.getDate();
  },

  /**
   * Day difference between two dates
   *
   * @method datePlusDays
   * @param {Date}  startDate
   * @param {Date}  endDate
   * @param {bool}  includeLastDay  adds an additional day for the last date
   * @return {int}  number of days inbetween
   * @public
   */
  diffDays(startDate, endDate, includeLastDay) {

    if (!startDate || !endDate) return;

    let diffDays = Math.floor((this.getNewDate(endDate).getTime() - this.getNewDate(startDate).getTime()) / (24*60*60*1000));

    if (includeLastDay) {
      diffDays+=1;
    }

    return diffDays;
  },

  /**
   * Get Calendar-Week to date
   *
   * @method getCW
   * @param {Date}  date
   * @return {int}  calendar week
   * @public
   */
  getCW(date) {
    date = this.getNewDate(date);

    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    date.setDate(date.getDate() + 4 - (date.getDay()||7)); // Get first day of year
    let yearStart = new Date(date.getFullYear(),0,1); // Calculate full weeks to nearest Thursday
    let week = Math.ceil(( ( (date - yearStart) / 86400000) + 1)/7);

    return week;

    // MY VERSION
    // let firstJan = this.getNewDate(date.getFullYear()+'-01-01');
    // let days = this.diffDays(firstJan, date, true);

    // let firstYearWeekday = firstJan.getDay() || 7; // 1
    // let weekOffset = ((8 - firstYearWeekday)  % 7);
    // let week = Math.ceil((days - weekOffset) / 7);
    //  console.log(`(${days} - ${weekOffset}) / 7)`, '='+week+' in '+ date.toString());
    // return week;
  },

  /**
   * Merge time-period objects that implement dateStart and dateEnd attributes within a given date range
   *
   * @method mergeTimePeriods
   * @param {array} childs
   * @param {Date}  periodStart
   * @param {Date}  periodEnd
   * @return {array}
   * @public
   */
  mergeTimePeriods(childs, periodStart, periodEnd) {

    if (!isArray(childs) || !(childs.length > 0)) return null;

    // go through dates and search periods including active childs
    let periods = A(),
        actChilds = A() ,
        actIndex = 0,
        actDate = this.getNewDate(new Date(periodStart).getTime()).getTime(), // assure 0 hours 
        endDate = this.datePlusDays(new Date(periodEnd).getTime(), 1).getTime(),
        dateMap = this.preparePeriodDateMap(childs, periodStart, periodEnd);

    let debugmax = 0;
    while(actDate < endDate) {

      // TODO: remove once its stable
      debugmax++;
      if (debugmax>1000) break;

      // add/remove childs with same start/end date to/from stack
      while(dateMap[actIndex] && dateMap[actIndex].timestamp === actDate) {

        let dateItem = dateMap[actIndex];

        if (dateItem.isStart) {
          actChilds.pushObject(dateItem.child);
        } else {
          actChilds.removeObject(dateItem.child);
        }

        actIndex++;
      }

      // next date
      let nextDate = (dateMap.length > (actIndex)) ? dateMap[actIndex].timestamp : endDate;

      // add period entry with active childs
      periods.pushObject({
        dateStart: this.getNewDate(actDate),
        dateEnd: this.datePlusDays(new Date(nextDate).getTime(), -1), // including last day
        childs: A(actChilds.toArray()) // clone it
      });

      // start next iteration with nextDate
      actDate = nextDate;
    }

    return periods;
  },

  /**
   * Prepare array from period-childs consisting of objects with all start/end dates for iterating
   *
   * @method preparePeriodDateMap
   * @param {array} childs
   * @param {Date}  periodStart
   * @param {Date}  periodEnd
   * @return {array} format: [{ timestamp:timestamp1, isStart:true, child:childObj }, {timestamp:timestamp2, isStart:false, child:childObj2 }}
   * @private
   */
  preparePeriodDateMap(childs, periodStart, periodEnd) {

    let dateMap = A();
    childs.forEach(child => {

      let start = get(child, 'dateStart');
      let end = get(child, 'dateEnd');

      // ignore childs out of boundary or adjust Date
      if ( end < periodStart || start > periodEnd ) return;

      // dateStart
      dateMap.pushObject({
        timestamp: Math.max(start, periodStart), //this.getNewDate(Math.max()).getTime(),
        // debugDate: this.getNewDate(Math.max(start, periodStart)),
        isStart: true,
        child: child
      });

      // dateEnd
      dateMap.pushObject({
        timestamp: this.datePlusDays(Math.min(end, periodEnd), +1).getTime(), // add 1 day, so overlapping is ok
        // debugDate: this.datePlusDays(Math.min(end, periodEnd), +1),
        isStart: false,
        child: child
      });

    });

    return dateMap.sortBy('timestamp');
  },

  /**
   * Months in period
   * generates an array with months in period including days (see return)
   *
   * @method monthsInPeriod
   * @param {Date}   startDate
   * @param {Date}   endDate
   * @param {int}    dayWidth
   * @param {object} specialDays  special object with day-classes and titles for grid colors ({ 15315121545 (timestamp): { title: 'Today', class:'today'}})
   * @return {array} e.g. [ { date: FIRST_DAY_OF_MONTH_DATE, totalDays: 31, width: 500, style: 'width:500px', days: [ ... ] -> day = { nr: 1, date: DATE, isWeekend: true}
   * @public
   */
  monthsInPeriod(startDate, endDate, dayWidth, specialDays) {

    let months = [];
    let actDate = this.getNewDate(startDate.getTime());
    specialDays = specialDays || {};

    // MONTHS AND DAYS
    while(actDate < endDate) {

      // from/to days
      let startDay = 1;
      let lastDay = this.daysInMonth(actDate);

      // first month
      if (isEqual(startDate, actDate)) {
        startDay = actDate.getDate();
      } else {
        actDate.setDate(1);
      }

      // last month
      if (actDate.getMonth() === endDate.getMonth() &&
          actDate.getFullYear() === endDate.getFullYear()) {

        lastDay = endDate.getDate();
      }

      // month data
      let month = {
        date: this.getNewDate(actDate),
        totalDays: lastDay,
        days: [],
        width: ((lastDay - startDay) +1) * dayWidth,
        label: this.getMonthName(actDate, false),
        labelShort: this.getMonthName(actDate, true)
      };

      month.style = htmlSafe(`width:${month.width}px`);

      // iterate all days to generate data-array
      for(let d=startDay; d<=lastDay; d++) {
        let dayDate = this.getNewDate(actDate);
        let day = {
          nr: d,
          date: dayDate.setDate(d),
          isWeekend: ([0,6].indexOf(dayDate.getDay()) >=0),
          title: '',
          class: ''
        };

        // special day
        if (dayDate.getTime() in specialDays) {
          day.title = specialDays[dayDate.getTime()].title;
          day.class = specialDays[dayDate.getTime()].class;
        }

        month.days.push(day);
      }

      // add days to month
      months.push(month);
      actDate.setMonth(actDate.getMonth()+1);
    }

    return months;
  },

  /**
   * calendar weeks in period
   * generates an array with calendar weeks in period
   *
   * @method calendarWeeksInPeriod
   * @param {Date}  startDate
   * @param {Date}  endDate
   * @param {int}  dayWidth
   * @return {array} e.g. [ { date: FIRST_DATE, nr: 33, width: 'width: 55px' } ]
   * @public
   */
  calendarWeeksInPeriod(startDate, endDate, dayWidth) {

    let cws = [];
    let firstCW = this.getCW(startDate);
    let firstWD = startDate.getDay() || 7; // Sunday -> 7
    let firstCWrest = 8 - firstWD;
    let actDate = this.getNewDate(startDate.getTime());

    // first cw
    cws.push({ date: firstCW, nr: this.getCW(startDate), width: htmlSafe('width: ' + (firstCWrest * dayWidth) + 'px;') }); // special width for first/last

    // middle cws
    actDate = this.datePlusDays(new Date(startDate.getTime()), firstCWrest);
    while(actDate <= endDate) {
      cws.push({ date: this.getNewDate(actDate), nr: this.getCW(actDate) });
      actDate.setDate(actDate.getDate() + 7); // add 7 days
    }

    // adjust last cw
    let lastCWrest = this.diffDays(cws[cws.length - 1].date, endDate, true);
    cws[cws.length - 1].width = htmlSafe('width: ' + (lastCWrest * dayWidth) + 'px');

    return cws;
  },


  /**
   * year(s) in period
   * generates an array with years in period
   *
   * @method monthsInPeriod
   * @param {Date}  startDate
   * @param {Date}  endDate
   * @param {int}   dayWidth
   * @return {array} e.g. [ { date: FIRST_DAY_OF_YEAR_DATE, nr: 2015, width: 'width: 250px' }, ... ]
   * @public
   */
  yearsInPeriod(startDate, endDate, dayWidth) {

    let years = [];
    let actDate = this.getNewDate(startDate.getTime());

    // middle cws
    while(actDate <= endDate) {

      let nextDate = this.getNewDate( (actDate.getFullYear()+1) + '-01-01');
      nextDate = (endDate <= nextDate) ? endDate : nextDate; // max until endDate

      let isLast = (actDate.getFullYear() === nextDate.getFullYear());

      years.push({
        date: actDate,
        nr: actDate.getFullYear(),
        width: htmlSafe( 'width:' + (this.diffDays(actDate, nextDate, isLast) * dayWidth) + 'px' ),
      });

      if (isLast) {
        break;
      }

      actDate = nextDate;
    }

    return years;
  },


  /**
   * fallback month names if I18N API no available
   *
   * @property monthNames
   * @type array
   */
  monthNames: Object.freeze(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'Septemer', 'October', 'November', 'December']),

  /**
   * get month name
   *
   * @method getMonthName
   * @param {Date}  date
   * @param {bool}  short
   * @return {string}
   * @public
   */
  getMonthName(date, short, locale) {
    short = isNone(short) ? false : short,
    date = this.getNewDate(date);

    locale = locale || window.navigator.userLanguage || window.navigator.language || 'EN-US';

    let options = { month: (short ? 'short' : 'long' ) };
    let monthName = date.toLocaleDateString(locale, options);

    if (isEmpty(monthName) || /[0-9]/.test(monthName)) {
      monthName = this.monthNames[ date.getMonth() ];
      monthName = short ? monthName.substring(0,3) : monthName;
    }

    if (!short) {
      monthName+= ' ' + date.getFullYear();
    }

    return monthName;
  }


}
