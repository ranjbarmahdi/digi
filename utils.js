const reader = require('xlsx');

function writeExcel(jsonFile, excelDir) {
    let workBook = reader.utils.book_new();
    const workSheet = reader.utils.json_to_sheet(jsonFile);
    reader.utils.book_append_sheet(workBook, workSheet, `response`);
    reader.writeFile(workBook, excelDir);
}

function suitableJsonOutput(oldJson){
    const suitableOutput = oldJson.map((item, index) => {
        const productExcelDataObject = {
            URL: item.URL,
            xpath: item.xpath,
            'خصوصیات / ویژگی‌ها': item.specifications,
            'توضیحات': item.description,
            'قیمت (تومان)': item.price ,
            'واحد اندازه‌گیری': 'عدد' ,
            'دسته‌بندی': item.category ,
            'برند': item.brand ,
            SKU: item.SKU,
            name: item.name ,
            'ردیف': index + 1 
        };
        if (!productExcelDataObject['قیمت (تومان)'] && !productExcelDataObject['offPrice']) {
            productExcelDataObject['xpath'] = '';
        }
        return productExcelDataObject;
    })
    return suitableOutput;
}

module.exports = {
    writeExcel,
    suitableJsonOutput
}



